

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import inspect
import re
import logging

try:
    from code_documentation_tool import generate_documentation, code_documenter_agent
    from github_tools import fetch_github_file_content, commit_to_github
    from utils.code_documentation_helper import generate_multi_file_documentation
except ImportError as e:
    print(f"Failed to import required modules: {e}")
    raise

app = FastAPI(title="Encora AIVA Code Documenter API", version="1.0.0")


class LocalCodeDocumenter:
    """Local tool for code documentation and analysis (no Azure dependencies)."""
    def document_code(self, prompt: str, path: Optional[str] = None) -> Any:
        """
        Locally generates documentation for the provided code.
        Returns a header, line count, and a summary.
        """
        code = prompt.strip()
        lines = code.splitlines()
        line_count = len(lines)
        header = f"# Documented by LocalCodeDocumenter\n# Lines: {line_count}\n"
        summary = f"This code has {line_count} lines.\nFirst line: {lines[0] if lines else 'N/A'}"
        documented_code = header + code
        return {
            "summary": summary,
            "documented_code": documented_code
        }

    def analyze_code(self, prompt: str, path: Optional[str] = None) -> Any:
        """
        Locally analyzes the provided code and returns basic stats.
        """
        code = prompt.strip()
        lines = code.splitlines()
        line_count = len(lines)
        function_count = sum(1 for l in lines if l.strip().startswith('def ') or l.strip().startswith('function '))
        analysis = {
            "line_count": line_count,
            "function_count": function_count,
            "first_line": lines[0] if lines else 'N/A',
            "language_guess": self.guess_language(code)
        }
        return analysis

    def guess_language(self, code: str) -> str:
        if 'import ' in code and 'def ' in code:
            return 'python'
        if 'function ' in code or 'console.log' in code:
            return 'javascript'
        if '#include' in code:
            return 'cpp/c'
        return 'unknown'

    def fetch_github_file(self, repository_url: str, file_path: str, branch: str = "main") -> Any:
        """
        Fetch a file from a GitHub repository.
        Args:
            repository_url (str): GitHub repository URL.
            file_path (str): Path to the file in the repository.
            branch (str): Branch name (default: "main").
        Returns:
            Dict with file content and metadata.
        """
        owner, repo = self.parse_repository_url(repository_url)
        content = fetch_github_file_content(owner, repo, file_path, branch)
        return {
            "content": content,
            "repository": repository_url,
            "file_path": file_path,
            "branch": branch
        }

    def commit_github_file(self, repository_url: str, file_path: str, content: str, commit_message: str, branch: str = "main") -> Any:
        """
        Commit a file to a GitHub repository.
        Args:
            repository_url (str): GitHub repository URL.
            file_path (str): Path to the file in the repository.
            content (str): File content to commit.
            commit_message (str): Commit message.
            branch (str): Branch name (default: "main").
        Returns:
            Dict with commit result and metadata.
        """
        owner, repo = self.parse_repository_url(repository_url)
        result = commit_to_github(owner, repo, file_path, content, commit_message, branch)
        return {
            "result": result,
            "repository": repository_url,
            "file_path": file_path,
            "branch": branch
        }

    def document_multiple_files(self, files_to_document: List[Dict[str, str]], repository_url: str, branch: str = "main") -> Any:
        """
        Generate documentation for multiple files in a repository.
        Args:
            files_to_document (List[Dict[str, str]]): List of files with 'path' and 'content'.
            repository_url (str): GitHub repository URL.
            branch (str): Branch name (default: "main").
        Returns:
            Documentation result (Any).
        """
        return generate_multi_file_documentation(files_to_document, repository_url, branch)

    def analyze_multiple_files(self, files_to_analyze: List[Dict[str, str]], repository_url: str, branch: str = "main") -> Any:
        """
        Perform analysis for multiple files in a repository.
        Args:
            files_to_analyze (List[Dict[str, str]]): List of files with 'path' and 'content'.
            repository_url (str): GitHub repository URL.
            branch (str): Branch name (default: "main").
        Returns:
            Analysis result (Any).
        """
        return generate_multi_file_documentation(files_to_analyze, repository_url, branch)

    def search_workspace_files(self, root_dir: str, filename: Optional[str] = None, pattern: Optional[str] = None, debug: bool = False) -> Any:
        """
        Search for files in the workspace by filename or pattern.
        Args:
            root_dir (str): Root directory to search.
            filename (Optional[str]): Filename to match.
            pattern (Optional[str]): Pattern to match.
            debug (bool): Enable debug output.
        Returns:
            List of file paths (Any).
        """
        from utils.code_documentation_helper import find_target_files
        return find_target_files(root_dir, filename=filename, pattern=pattern, debug=debug)

    def chunked_documentation(self, prompt: str, include_analysis: bool = True) -> Any:
        """
        Generate documentation for large files using chunking strategy.
        Args:
            prompt (str): The code or request to document.
            include_analysis (bool): Whether to include analysis sections.
        Returns:
            Documentation result (Any).
        """
        from utils.code_documentation_helper import code_documenter_agent_with_chunking
        return code_documenter_agent_with_chunking(prompt, include_analysis=include_analysis)

    @staticmethod
    def parse_repository_url(repository_url: str) -> tuple:
        """
        Parse a GitHub repository URL into owner and repo name.
        Args:
            repository_url (str): GitHub repository URL.
        Returns:
            Tuple of (owner, repo).
        """
        if "github.com/" in repository_url:
            parts = repository_url.split("github.com/")[1].split("/")
            return parts[0], parts[1].replace(".git", "")
        raise ValueError("Invalid GitHub repository URL")

    @staticmethod
    def detect_language(path: Optional[str]) -> str:
        """
        Detect the programming language from a file path by extension.
        Args:
            path (Optional[str]): File path or name.
        Returns:
            str: Detected language or 'unknown'.
        """
        if not path:
            return "unknown"
        extensions = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".java": "java",
            ".cpp": "cpp",
            ".c": "c",
            ".cs": "csharp",
            ".go": "go",
            ".rs": "rust",
            ".php": "php",
            ".rb": "ruby"
        }
        for ext, lang in extensions.items():
            if path.endswith(ext):
                return lang
        return "unknown"

tools = {
    "CodeDocumenterTool": LocalCodeDocumenter()
}


class ToolRequest(BaseModel):
    prompt: str
    path: Optional[str] = None

class GitHubFileRequest(BaseModel):
    repository_url: str
    file_path: str
    branch: str = "main"

class GitHubCommitRequest(BaseModel):
    repository_url: str
    file_path: str
    content: str
    commit_message: str
    branch: str = "main"

class MultiFileDocumentationRequest(BaseModel):
    files_to_document: List[Dict[str, str]]  # Each dict: {"path": ..., "content": ...}
    repository_url: str
    branch: str = "main"

class MultiFileAnalysisRequest(BaseModel):
    files_to_analyze: List[Dict[str, str]]
    repository_url: str
    branch: str = "main"

class WorkspaceSearchRequest(BaseModel):
    root_dir: str
    filename: Optional[str] = None
    pattern: Optional[str] = None
    debug: bool = False

class ChunkedDocumentationRequest(BaseModel):
    prompt: str
    include_analysis: bool = True

class ToolResponse(BaseModel):
    success: bool
    result: Any = None
    error: str = None

@app.get("/", summary="API Root", description="Welcome to the Encora AIVA Code Documenter API. Use /tools to list available tools.")
async def root():
    return {"message": "Encora AIVA Code Documenter API", "tools": list(tools.keys())}

@app.get("/tools")
async def list_tools():
    tool_info = {}
    for name, tool in tools.items():
        methods = {}
        for method_name in dir(tool):
            if not method_name.startswith('_') and callable(getattr(tool, method_name)):
                method = getattr(tool, method_name)
                sig = inspect.signature(method)
                methods[method_name] = {
                    "parameters": [param.name for param in sig.parameters.values()],
                    "doc": method.__doc__ or "No description available"
                }
        tool_info[name] = {
            "description": tool.__class__.__doc__ or "No description available",
            "operations": methods
        }
    return tool_info

@app.get("/health")
async def health():    
    return {"status": "healthy", "mode": "PRODUCTION"}

@app.post(
    "/github/fetch_file",
    response_model=ToolResponse,
    summary="Fetch file from GitHub",
    description="Retrieves a file from a GitHub repository."
)
async def execute_fetch_github_file(request: GitHubFileRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.fetch_github_file(request.repository_url, request.file_path, request.branch)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch GitHub file: {e}")
    
@app.post(
    "/document_code",
    response_model=ToolResponse,
    summary="Generate code documentation",
    description="Generates comprehensive documentation for provided code."
)
async def execute_document_code(request: ToolRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.document_code(request.prompt, request.path)
        return ToolResponse(success=True, result={
            "documentation": result,
            "language": tool.detect_language(request.path),
            "mode": "PRODUCTION"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate documentation: {e}")

@app.post(
    "/analyze_code",
    response_model=ToolResponse,
    summary="Analyze code",
    description="Performs comprehensive code analysis including security and performance review."
)
async def execute_analyze_code(request: ToolRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.analyze_code(request.prompt, request.path)
        return ToolResponse(success=True, result={
            "analysis": result,
            "language": tool.detect_language(request.path),
            "mode": "PRODUCTION"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze code: {e}")

@app.post(
    "/github/commit_file",
    response_model=ToolResponse,
    summary="Commit file to GitHub",
    description="Commits a file to a GitHub repository."
)
async def execute_commit_github_file(request: GitHubCommitRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.commit_github_file(request.repository_url, request.file_path, request.content, request.commit_message, request.branch)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to commit to GitHub: {e}")
    
@app.post(
    "/document_multiple_files",
    response_model=ToolResponse,
    summary="Generate documentation for multiple files",
    description="Generates comprehensive documentation for multiple files in a repository."
)
async def execute_document_multiple_files(request: MultiFileDocumentationRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.document_multiple_files(request.files_to_document, request.repository_url, request.branch)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to document multiple files: {e}")

@app.post(
    "/analyze_multiple_files",
    response_model=ToolResponse,
    summary="Analyze multiple files",
    description="Performs comprehensive analysis for multiple files in a repository."
)
async def execute_analyze_multiple_files(request: MultiFileAnalysisRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.analyze_multiple_files(request.files_to_analyze, request.repository_url, request.branch)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze multiple files: {e}")

@app.post(
    "/search_workspace_files",
    response_model=ToolResponse,
    summary="Search files in workspace",
    description="Searches for files in the workspace by filename or pattern."
)
async def execute_search_workspace_files(request: WorkspaceSearchRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.search_workspace_files(request.root_dir, request.filename, request.pattern, request.debug)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search workspace files: {e}")

@app.post(
    "/chunked_documentation",
    response_model=ToolResponse,
    summary="Chunked documentation for large files",
    description="Generates documentation for large files using chunking strategy."
)
async def execute_chunked_documentation(request: ChunkedDocumentationRequest) -> ToolResponse:
    try:
        tool = tools["CodeDocumenterTool"]
        result = tool.chunked_documentation(request.prompt, request.include_analysis)
        return ToolResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate chunked documentation: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)