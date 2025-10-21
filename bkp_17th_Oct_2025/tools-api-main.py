"""
FastAPI server for Encora AIVA Code Documenter Tool
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
import sys
import os

# Add the current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import production modules; make imports robust for package or script execution
try:
    # Prefer package-style imports when available
    from . import code_documentation_tool
    from . import github_tools
    from .utils import code_documentation_helper as helper
except Exception:
    # Fallback to direct imports for script execution
    import code_documentation_tool
    import github_tools
    import utils.code_documentation_helper as helper

# Adapter functions to match expected signatures
_generate_doc = code_documentation_tool.generate_documentation
_fetch_github_raw = github_tools.fetch_github_file_content
_code_agent = helper.code_documenter_agent_with_chunking

def generate_documentation(prompt: str, path: Optional[str] = None) -> str:
    return _generate_doc(prompt, original_path=path)

def _parse_repo_url(repository_url: str):
    if "github.com/" in repository_url:
        parts = repository_url.replace("https://github.com/", "").replace("http://github.com/", "").split("/")
        return parts[0], parts[1]
    return repository_url.split("/")

def fetch_github_file_content(repository_url: str, file_path: str, branch: str = "main") -> Dict[str, Any]:
    owner, repo = _parse_repo_url(repository_url)
    content = _fetch_github_raw(owner, repo, file_path, branch)
    return {
        "success": True,
        "content": content,
        "repository": repository_url,
        "file_path": file_path,
        "branch": branch,
        "message": "File fetched successfully"
    }

def code_documenter_agent(prompt: str, include_analysis: bool = False) -> str:
    return _code_agent(prompt, include_analysis=include_analysis)

def commit_file_to_github(repository_url: str, file_path: str, content: str, commit_message: str, branch: str = "main") -> Dict[str, Any]:
    owner, repo = _parse_repo_url(repository_url)
    result = github_tools.commit_to_github(owner, repo, file_path, content, commit_message, branch)
    return {"success": True, "result": result}

def analyze_repository_structure(repository_url: str, branch: str = "main") -> Dict[str, Any]:
    owner, repo = _parse_repo_url(repository_url)
    try:
        tree = github_tools.get_repository_tree(owner, repo, branch=branch, recursive=False)
        return {"success": True, "repository": repository_url, "branch": branch, "tree": tree}
    except AttributeError:
        contents = github_tools.list_repository_contents(owner, repo, path="", branch=branch)
        return {"success": True, "repository": repository_url, "branch": branch, "contents": contents}

def generate_multi_file_documentation(files_to_document: list, repository_url: str, branch: str = "main") -> str:
    docs = []
    for file_info in files_to_document:
        file_path = file_info.get('path', 'unknown')
        file_content = file_info.get('content', f'Content for {file_path}')
        doc = generate_documentation(file_content, file_path)
        docs.append(f"## {file_path}\n{doc}")

    combined_doc = f"# Multi-File Documentation\n\n"
    combined_doc += f"Repository: {repository_url}\n"
    combined_doc += f"Branch: {branch}\n"
    combined_doc += f"Files processed: {len(files_to_document)}\n\n"
    combined_doc += "\n\n".join(docs)
    return combined_doc

MOCK_MODE = False
logger.info("Running in PRODUCTION mode")

app = FastAPI(
    title="Encora AIVA Code Documenter API", 
    version="1.0.0",
    description="AI-powered code documentation and analysis tools API"
)

# Request/Response models
class ToolRequest(BaseModel):
    prompt: str
    path: Optional[str] = None

class ToolResponse(BaseModel):
    success: bool
    result: Any = None
    error: Optional[str] = None

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

class RepositoryAnalysisRequest(BaseModel):
    repository_url: str
    branch: str = "main"

class MultiFileDocumentationRequest(BaseModel):
    repository_url: str
    files_to_document: List[Dict[str, Any]]
    branch: str = "main"

# Language mapping for file extensions
LANGUAGE_MAPPING = {
    # Python
    '.py': 'python',
    '.pyw': 'python',
    '.pyi': 'python',
    
    # JavaScript/TypeScript
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    
    # Java
    '.java': 'java',
    '.class': 'java',
    '.jar': 'java',
    
    # C/C++
    '.c': 'c',
    '.cpp': 'cpp',
    '.cxx': 'cpp',
    '.cc': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.hxx': 'cpp',
    
    # C#
    '.cs': 'csharp',
    '.csx': 'csharp',
    
    # Web Technologies
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    
    # PHP
    '.php': 'php',
    '.phtml': 'php',
    '.php3': 'php',
    '.php4': 'php',
    '.php5': 'php',
    
    # Ruby
    '.rb': 'ruby',
    '.rbw': 'ruby',
    
    # Go
    '.go': 'go',
    
    # Rust
    '.rs': 'rust',
    
    # Swift
    '.swift': 'swift',
    
    # Kotlin
    '.kt': 'kotlin',
    '.kts': 'kotlin',
    
    # Scala
    '.scala': 'scala',
    '.sc': 'scala',
    
    # Shell scripts
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.fish': 'fish',
    '.ps1': 'powershell',
    
    # Configuration files
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.conf': 'config',
    
    # Markup
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.rst': 'restructuredtext',
    '.tex': 'latex',
    
    # SQL
    '.sql': 'sql',
    '.mysql': 'sql',
    '.postgresql': 'sql',
    
    # R
    '.r': 'r',
    '.R': 'r',
    
    # MATLAB
    '.m': 'matlab',
    
    # Perl
    '.pl': 'perl',
    '.pm': 'perl',
    
    # Lua
    '.lua': 'lua',
    
    # Docker
    'Dockerfile': 'dockerfile',
    '.dockerfile': 'dockerfile',
    
    # Node.js specific
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    
    # .NET specific
    '.vb': 'vbnet',
    '.fs': 'fsharp',
    
    # React/Vue
    '.vue': 'vue',
    '.svelte': 'svelte'
}

def get_language_from_extension(filename: str) -> str:
    """Get programming language from file extension"""
    if not filename:
        return 'text'
    
    # Handle special cases like Dockerfile
    if filename == 'Dockerfile' or filename.endswith('Dockerfile'):
        return 'dockerfile'
    
    # Get file extension
    if '.' in filename:
        ext = '.' + filename.split('.')[-1].lower()
        return LANGUAGE_MAPPING.get(ext, 'text')
    
    return 'text'

# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint - API welcome message"""
    return {
        "message": "Welcome to Encora AIVA Code Documenter API",
        "version": "1.0.0",
        "description": "AI-powered code documentation and analysis tools",
        "mode": "MOCK" if MOCK_MODE else "PRODUCTION",
        "docs": "/docs",
        "health": "/health",
        "tools": "/tools"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mode": "MOCK" if MOCK_MODE else "PRODUCTION",
        "message": "Encora AIVA Code Documenter API is running"
    }

# Get available tools
@app.get("/tools")
async def list_tools():
    """List all available tools and their operations"""
    return {
        "code_documentation": {
            "description": "Generate comprehensive documentation for code",
            "operations": ["document", "analyze"],
            "endpoints": ["/document_code", "/analyze_code"]
        },
        "github_integration": {
            "description": "GitHub repository operations",
            "operations": ["fetch_file", "commit_file", "analyze_repository"],
            "endpoints": ["/github/fetch_file", "/github/commit_file", "/github/analyze_repository"]
        },
        "multi_file_analysis": {
            "description": "Analyze and document multiple files",
            "operations": ["batch_document"],
            "endpoints": ["/document_multiple_files"]
        }
    }

# Code analysis guide endpoint
@app.get("/code_analysis_guide", response_model=ToolResponse)
async def get_code_analysis_guide():
    """Get comprehensive guide for code analysis and documentation"""
    guide_content = """# Code Analysis Guide

## Overview
This guide provides best practices for code analysis and documentation using the Encora AIVA Code Documenter API.

## Supported Languages
The API supports analysis for the following programming languages:
- Python (.py, .pyw, .pyi)
- JavaScript/TypeScript (.js, .jsx, .ts, .tsx)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- C# (.cs)
- And many more...

## API Endpoints

### 1. Document Code
**POST /document_code**
- Generate comprehensive documentation for code snippets
- Supports file path for language detection

### 2. Analyze Code
**POST /analyze_code** 
- Perform detailed code analysis
- Includes complexity assessment and recommendations

### 3. GitHub Integration
- **POST /github/fetch_file** - Fetch files from GitHub repositories
- **POST /github/commit_file** - Commit documented files back to GitHub
- **POST /github/analyze_repository** - Analyze entire repository structure

### 4. Multi-File Documentation
**POST /document_multiple_files**
- Process multiple files in batch
- Generate comprehensive project documentation

## Best Practices

1. **Provide Context**: Include file paths for better language detection
2. **Use Descriptive Prompts**: Clear descriptions yield better documentation
3. **Batch Processing**: Use multi-file endpoints for large projects
4. **GitHub Integration**: Leverage direct repository integration for seamless workflows

## Example Usage

```python
import requests

# Document a Python function
response = requests.post("http://localhost:8000/document_code", json={
    "prompt": "def calculate_fibonacci(n): return n if n <= 1 else calculate_fibonacci(n-1) + calculate_fibonacci(n-2)",
    "path": "fibonacci.py"
})
```

## Response Format
All endpoints return standardized responses with:
- `success`: Boolean indicating operation status
- `result`: Analysis or documentation content
- `error`: Error message if operation fails

## Support
For additional help, visit the interactive API documentation at `/docs`
"""
    
    return ToolResponse(
        success=True,
        result={
            "guide": guide_content,
            "endpoints_count": 8,
            "supported_languages": len(LANGUAGE_MAPPING),
            "mode": "MOCK" if MOCK_MODE else "PRODUCTION"
        }
    )

# Document code endpoint
@app.post("/document_code", response_model=ToolResponse)
async def document_code(request: ToolRequest):
    """Document code using AI agent - returns documented code (PART 2) only"""
    try:
        # Generate the combined result (analysis + documented code)
        combined = generate_documentation(request.prompt, request.path)

        # Parse into analysis and documented code
        try:
            try:
                from .utils.response_parser import parse_analysis_and_code
            except Exception:
                from utils.response_parser import parse_analysis_and_code

            analysis, documented_code = parse_analysis_and_code(combined)
        except Exception:
            # If parsing fails, fall back to returning the raw combined output as documentation
            documented_code = combined
            analysis = ""

        logger.info(f"Documentation generated successfully for prompt: {request.prompt[:50]}...")
        return ToolResponse(
            success=True,
            result={
                "documentation": documented_code,
                "language": get_language_from_extension(request.path) if request.path else "text",
                "mode": "PRODUCTION"
            }
        )
    except Exception as e:
        logger.error(f"Error generating documentation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Documentation generation failed: {str(e)}")

# Analyze code endpoint
@app.post("/analyze_code", response_model=ToolResponse)
async def analyze_code(request: ToolRequest):
    """Analyze code using AI agent - returns analysis (PART 1) only"""
    try:
        # Use the same generation path to ensure full/consistent analysis is produced
        combined = generate_documentation(request.prompt, request.path)

        # Parse into analysis and documented code
        try:
            try:
                from .utils.response_parser import parse_analysis_and_code
            except Exception:
                from utils.response_parser import parse_analysis_and_code

            analysis, documented_code = parse_analysis_and_code(combined)
        except Exception:
            # If parsing fails, fall back to returning the raw combined output as analysis
            analysis = combined
            documented_code = ""

        logger.info(f"Code analysis completed successfully")
        return ToolResponse(
            success=True,
            result={
                "analysis": analysis,
                "language": get_language_from_extension(request.path) if request.path else "text",
                "mode": "PRODUCTION"
            }
        )
    except Exception as e:
        logger.error(f"Error analyzing code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Code analysis failed: {str(e)}")

# GitHub endpoints
@app.post("/github/fetch_file", response_model=ToolResponse)
async def fetch_github_file(request: GitHubFileRequest):
    """Fetch file content from GitHub repository"""
    try:
        result = fetch_github_file_content(
            request.repository_url, 
            request.file_path, 
            request.branch
        )
        logger.info(f"GitHub file fetched: {request.file_path}")
        return ToolResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Error fetching GitHub file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GitHub file fetch failed: {str(e)}")

@app.post("/github/commit_file", response_model=ToolResponse)
async def commit_github_file(request: GitHubCommitRequest):
    """Commit file to GitHub repository"""
    try:
        result = commit_file_to_github(
            request.repository_url,
            request.file_path,
            request.content,
            request.commit_message,
            request.branch
        )
        logger.info(f"File committed to GitHub: {request.file_path}")
        return ToolResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Error committing to GitHub: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GitHub commit failed: {str(e)}")

@app.post("/github/analyze_repository", response_model=ToolResponse)
async def analyze_github_repository(request: RepositoryAnalysisRequest):
    """Analyze GitHub repository structure"""
    try:
        result = analyze_repository_structure(request.repository_url, request.branch)
        logger.info(f"Repository analyzed: {request.repository_url}")
        return ToolResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Error analyzing repository: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Repository analysis failed: {str(e)}")

# Multi-file documentation endpoint
@app.post("/document_multiple_files", response_model=ToolResponse)
async def document_multiple_files(request: MultiFileDocumentationRequest):
    """Generate documentation for multiple files"""
    try:
        result = generate_multi_file_documentation(
            request.files_to_document,
            request.repository_url,
            request.branch
        )
        logger.info(f"Multi-file documentation generated for {len(request.files_to_document)} files")
        return ToolResponse(
            success=True,
            result={
                "documentation": result,
                "files_processed": len(request.files_to_document),
                "mode": "MOCK" if MOCK_MODE else "PRODUCTION"
            }
        )
    except Exception as e:
        logger.error(f"Error generating multi-file documentation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Multi-file documentation failed: {str(e)}")


# Analyze multiple files (explicit endpoint)
@app.post("/analyze_multiple_files", response_model=ToolResponse)
async def analyze_multiple_files(request: MultiFileDocumentationRequest):
    """Analyze multiple provided files without requiring a repository URL"""
    try:
        files = request.files_to_document or []
        if not files:
            raise ValueError("No files provided for analysis")

        # Build a combined prompt for analysis-only (no saving/commits)
        from .utils.code_documentation_helper import detect_operation_type
        prompt_parts = ["MULTI-FILE ANALYSIS", f"Files: {len(files)}", "\n"]
        for f in files:
            prompt_parts.append(f"=== FILE: {f.get('path','unknown')} ===")
            prompt_parts.append(f.get('content',''))
            prompt_parts.append("\n")

        full_prompt = "\n".join(prompt_parts)
        result = code_documenter_agent(full_prompt, include_analysis=True)
        return ToolResponse(success=True, result={"analysis": result, "files": len(files), "mode": "PRODUCTION"})
    except Exception as e:
        logger.error(f"Error analyzing multiple files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Search workspace files endpoint
class SearchWorkspaceRequest(BaseModel):
    workspace_root: Optional[str] = None
    filename: Optional[str] = None
    pattern: Optional[str] = None

@app.post("/search_workspace_files", response_model=ToolResponse)
async def search_workspace_files(request: SearchWorkspaceRequest):
    try:
        from .utils.file_searcher import FileSearcher
        root = request.workspace_root or FileSearcher.get_workspace_root()
        if request.filename:
            matches = FileSearcher.find_files(root, request.filename)
        elif request.pattern:
            matches = FileSearcher.find_files_by_pattern(root, request.pattern)
        else:
            matches = FileSearcher.list_directory_contents(root, max_depth=2)

        return ToolResponse(success=True, result={"matches": matches})
    except Exception as e:
        logger.error(f"Error searching workspace files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Chunked documentation helper endpoint
class ChunkDocumentRequest(BaseModel):
    content: str
    original_path: Optional[str] = None

@app.post("/chunked_documentation", response_model=ToolResponse)
async def chunked_documentation(request: ChunkDocumentRequest):
    try:
        # Use helper to process large files with chunking
        from .utils.code_documentation_helper import code_documenter_agent_with_chunking
        result = code_documenter_agent_with_chunking(request.content, include_analysis=True)
        return ToolResponse(success=True, result={"documentation": result})
    except Exception as e:
        logger.error(f"Error in chunked documentation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Encora AIVA Code Documenter API server...")
    logger.info(f"Running in {'MOCK' if MOCK_MODE else 'PRODUCTION'} mode")
    uvicorn.run(app, host="0.0.0.0", port=8001)
