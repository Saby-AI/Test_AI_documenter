"""
GitHub Integration Tool for AIVA MCP Server

Optimized version: introduces operation Enum, in-memory caching, structured logging, error taxonomy, and large file guard.
Introduces operation E    def github_unified_tool(
        repository: str,
        operation: str = Operation.REVIEW.value,
        file_path: str = "",
        branch: str = "main",
        file_extensions: str = ".py,.js,.ts,.java,.cpp,.c,.h",
        max_files: int = 5,
        workflow_type: str = "detailed",
        list_path: str = "",
        commit_message: str = "",
        documented_suffix: str = DEFAULT_DOCUMENTED_SUFFIX,
        reviewed_suffix: str = "_reviewed",
        generated_code: str = "",
        request_text: str = "",
        confirm: str = "no",
        docs_folder: str = ""
    ) -> str:aching, structured logging, error taxonomy, large file guard, and explicit GitHub vs Local mode handling.
"""

import os
import logging
import json
import time
from enum import Enum
from datetime import datetime
from typing import Dict, Tuple, Optional
from pathlib import Path
import re

from .utils.response_parser import parse_analysis_and_code
from .github_tools import (
    fetch_github_file_content,
    commit_to_github,
    get_github_token,
    list_repository_contents,
    GitHubError,
    CACHING_AVAILABLE
)
from .code_documentation_tool import (
    code_documenter_agent,
    save_analysis_part,
    generate_documentation,
    TypeScriptAnalysisHelper
)
from .code_review_tool import code_reviewer_agent
from .utils.filename_generator import DEFAULT_DOCUMENTED_SUFFIX

logger = logging.getLogger(__name__)

TOOL_VERSION = "2025-09-11-**-exclusive-mode"  # Updated version

# --- Operation Enum ---
class Operation(str, Enum):
    AUTO = "auto"
    REVIEW = "review"
    REVIEW_COMMIT = "review_commit"
    DOCUMENT = "document"
    DOCUMENT_COMMIT = "document_commit"
    DOCUMENT_DIRECTORY = "document_directory"
    FETCH = "fetch_file"
    UPDATE_FILE = "update_file"

ALLOWED_OPS = {op.value for op in Operation}
LEGACY_OPS = {"review_and_document", "document_and_commit", "document_file"}

# --- Helper Functions ---
def determine_execution_mode(prompt: str, repository: str = "", repo_info: Optional[Dict] = None) -> str:
    """
    Determine if this is a GitHub or Local request.
    
    Args:
        prompt: The request text/prompt
        repository: Repository string (if provided)
        repo_info: Repository info dictionary (if provided)
    
    Returns:
        'github' - Push to GitHub only
        'local' - Save locally only
        'unknown' - Mode cannot be determined
    """
    prompt_lower = prompt.lower()
    
    # Check for explicit GitHub indicators
    github_indicators = [
        'github.com', 
        'push to github', 
        'commit to github', 
        'github repo',
        'repository:',
        'commit_message'
    ]
    
    # If repository is provided and not empty, it's likely a GitHub request
    if repository and repository.strip():
        return 'github'
    
    # If repo_info is provided, it's definitely a GitHub request
    if repo_info:
        return 'github'
    
    # Check prompt for GitHub indicators
    if any(indicator in prompt_lower for indicator in github_indicators):
        return 'github'
    
    # Check for explicit local indicators
    # local_indicators = [
    #     'copilot local',          
    #     'local file', 
    #     'don\'t push',
    #     'no github',
    #     'offline'
    # ]
    # if any(indicator in prompt_lower for indicator in local_indicators):
    #     return 'local'
    
    # Default to unknown
    return 'unknown'

def build_variant_filename(path: str, suffix: str) -> str:
    """Build filename with suffix for variants."""
    base, ext = os.path.splitext(path)
    # Avoid double underscore if suffix starts with '_'
    if suffix.startswith("_"):
        return f"{base}{suffix}{ext}"
    else:
        return f"{base}_{suffix}{ext}"

def build_documentation_paths(original_file_path: str, documented_suffix: str = "_documented", docs_folder: Optional[str] = None) -> Tuple[str, str]:
    """
    Build proper paths for documented and analysis files with configurable location and naming.
    
    Args:
        original_file_path: Original file path (e.g., "Test2/receiving-service.ts")
        documented_suffix: Suffix for documented files (default: "_documented")
        docs_folder: Optional folder to save documentation files (e.g., "docs", "documentation")
    
    Returns:
        Tuple of (documented_file_path, analysis_file_path)
    """
    # Parse the original file path
    dir_path = os.path.dirname(original_file_path)
    file_name = os.path.basename(original_file_path)
    base_name, ext = os.path.splitext(file_name)
    ext_no_dot = ext[1:] if ext.startswith('.') else ext
    
    # Determine target directory
    if docs_folder:
        # Save to specified docs folder, preserving subdirectory structure
        if dir_path:
            target_dir = f"{docs_folder}/{dir_path}"
        else:
            target_dir = docs_folder
    else:
        # Save to same directory as original file
        target_dir = dir_path
    
    # Build file paths with proper extensions
    if target_dir:
        documented_filename = f"{target_dir}/{base_name}{documented_suffix}{ext}"
        analysis_filename = f"{target_dir}/{base_name}_analysis_{ext_no_dot}.md"
    else:
        documented_filename = f"{base_name}{documented_suffix}{ext}"
        analysis_filename = f"{base_name}_analysis_{ext_no_dot}.md"
    
    return documented_filename, analysis_filename

def validate_doc_and_analysis_filenames(original_path, doc_filename, analysis_filename):
    """Auto-correct documentation and analysis file naming conventions if needed."""
    base, ext = os.path.splitext(original_path)
    ext_no_dot = ext[1:] if ext.startswith('.') else ext
    expected_doc = f"{base}_documented{ext}"
    expected_analysis = f"{base}_analysis_{ext_no_dot}.md"
    corrected = False
    if doc_filename != expected_doc:
        logger.warning(f"Auto-correcting documentation file name from '{doc_filename}' to '{expected_doc}'")
        doc_filename = expected_doc
        corrected = True
    if analysis_filename and analysis_filename != expected_analysis:
        logger.warning(f"Auto-correcting analysis file name from '{analysis_filename}' to '{expected_analysis}'")
        analysis_filename = expected_analysis
        corrected = True
    return doc_filename, analysis_filename, corrected

def map_exception(err_msg: str, file_path: str = "") -> str:
    """Map exceptions to user-friendly error messages."""
    err_lower = err_msg.lower()
    
    if "404" in err_lower or "not found" in err_lower:
        return f"Error: File '{file_path}' not found in repository"
    elif "401" in err_lower or "unauthorized" in err_lower:
        return "Error: GitHub authentication failed. Please check your token"
    elif "403" in err_lower or "forbidden" in err_lower:
        return "Error: Permission denied. Check repository access rights"
    elif "rate limit" in err_lower:
        return "Error: GitHub API rate limit exceeded. Please wait and try again"
    elif "timeout" in err_lower:
        return "Error: Request timed out. Please try again"
    else:
        return f"Error: {err_msg}"


def analyze_directory_structure(owner: str, repo: str, directory_path: str, branch: str = "main") -> str:
    """
    Analyze all files in a directory and create a comprehensive analysis showing relationships.
    
    Args:
        owner: GitHub username or organization name
        repo: Repository name
        directory_path: Path to the directory in the repository
        branch: Branch name (default: "main")
    
    Returns:
        Comprehensive analysis of all files and their relationships
    """
    try:
        # Get directory contents
        contents = list_repository_contents(owner, repo, directory_path, branch)
        files = [item for item in contents if item.get("type") == "file"]
        
        if not files:
            return f"No files found in directory '{directory_path}'"
        
        # Fetch content for all files
        file_contents = {}
        for file_info in files:
            file_path = str(file_info.get("path", ""))
            if file_path:
                try:
                    content = fetch_github_file_content(owner, repo, file_path, branch)
                    file_contents[file_path] = content
                except Exception as e:
                    logger.warning(f"Could not fetch {file_path}: {str(e)}")
        
        # Create comprehensive analysis
        analysis_sections = []
        
        # Header
        analysis_sections.append(f"# Comprehensive Package Analysis: {directory_path}")
        analysis_sections.append(f"**Repository:** {owner}/{repo}")
        analysis_sections.append(f"**Branch:** {branch}")
        analysis_sections.append(f"**Analysis Date:** {datetime.now().strftime('%d/%m/%Y')}")
        analysis_sections.append("")
        
        # Overview
        analysis_sections.append("## Package Overview")
        analysis_sections.append(f"This package contains {len(files)} files working together as a cohesive module:")
        for file_info in files:
            file_name = os.path.basename(str(file_info.get("path", "")))
            file_path = str(file_info.get("path", ""))
            analysis_sections.append(f"- **{file_name}**: {_analyze_file_purpose(file_name, file_contents.get(file_path, ''))}")
        analysis_sections.append("")
        
        # Class Relationships (for Java/OOP languages)
        if any(str(file_info.get("path", "")).endswith(('.java', '.cpp', '.cs', '.py')) for file_info in files):
            analysis_sections.append("## Class Relationships and Dependencies")
            relationships = _analyze_class_relationships(file_contents)
            analysis_sections.extend(relationships)
            analysis_sections.append("")
        
        # Architecture Analysis
        analysis_sections.append("## Architecture Analysis")
        architecture_analysis = _analyze_architecture_patterns(file_contents)
        analysis_sections.extend(architecture_analysis)
        analysis_sections.append("")
        
        # Integration Points
        analysis_sections.append("## Integration and Usage Patterns")
        integration_analysis = _analyze_integration_patterns(file_contents)
        analysis_sections.extend(integration_analysis)
        analysis_sections.append("")
        
        # Recommendations
        analysis_sections.append("## Documentation and Improvement Recommendations")
        recommendations = _generate_package_recommendations(file_contents)
        analysis_sections.extend(recommendations)
        
        return "\n".join(analysis_sections)
        
    except Exception as e:
        logger.error(f"Error analyzing directory structure: {str(e)}")
        return f"Error analyzing directory '{directory_path}': {str(e)}"


def _analyze_file_purpose(file_name: str, content: str) -> str:
    """Analyze the purpose of a single file based on its name and content."""
    if not content:
        return "Could not analyze - content unavailable"
    
    file_lower = file_name.lower()
    content_lower = content.lower()
    
    # Main/Entry point detection
    if "main" in file_lower or "public static void main" in content_lower:
        return "Main entry point and application orchestrator"
    
    # Model/Entity detection
    elif any(keyword in file_lower for keyword in ["model", "entity", "dto", "pojo"]):
        return "Data model/entity class defining core business objects"
    
    # Service/Business logic
    elif any(keyword in file_lower for keyword in ["service", "manager", "controller"]):
        return "Business logic and service operations"
    
    # Utility/Helper
    elif any(keyword in file_lower for keyword in ["util", "helper", "common"]):
        return "Utility/helper functions and common operations"
    
    # Configuration
    elif any(keyword in file_lower for keyword in ["config", "setting", "property"]):
        return "Configuration and settings management"
    
    # Test files
    elif any(keyword in file_lower for keyword in ["test", "spec"]):
        return "Test cases and verification logic"
    
    # General class analysis based on content
    else:
        if "class" in content_lower:
            if "extends" in content_lower or "implements" in content_lower:
                return "Specialized class implementing specific functionality"
            else:
                return "Core business logic class"
        elif "interface" in content_lower:
            return "Interface defining contracts and abstractions"
        else:
            return "Functional module providing specific capabilities"


def _analyze_class_relationships(file_contents: dict) -> list:
    """Analyze relationships between classes in the files."""
    relationships = []
    
    # Track imports and dependencies
    dependencies = {}
    class_definitions = {}
    
    for file_path, content in file_contents.items():
        file_name = os.path.basename(file_path)
        class_name = os.path.splitext(file_name)[0]
        
        # Find imports
        imports = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('import ') and not line.startswith('import java.'):
                import_match = line.replace('import ', '').replace(';', '').strip()
                if '.' in import_match:
                    imports.append(import_match.split('.')[-1])
                else:
                    imports.append(import_match)
        
        dependencies[class_name] = imports
        
        # Find class definition
        if 'class ' in content:
            class_definitions[class_name] = file_path
    
    # Analyze relationships
    relationships.append("### Dependency Graph:")
    for class_name, deps in dependencies.items():
        if deps:
            relationships.append(f"- **{class_name}** depends on: {', '.join(deps)}")
        else:
            relationships.append(f"- **{class_name}** has no external dependencies (within this package)")
    
    relationships.append("")
    relationships.append("### Class Hierarchy:")
    
    # Find main/entry classes
    main_classes = [name for name, path in class_definitions.items() 
                   if 'main' in name.lower() or 'public static void main' in file_contents.get(path, '')]
    
    if main_classes:
        relationships.append(f"- **Entry Point**: {', '.join(main_classes)}")
    
    # Find data models
    model_classes = [name for name, path in class_definitions.items() 
                    if not any(keyword in name.lower() for keyword in ['main', 'test', 'util'])]
    
    if model_classes:
        relationships.append(f"- **Data Models**: {', '.join(model_classes)}")
    
    return relationships


def _analyze_architecture_patterns(file_contents: dict) -> list:
    """Analyze architectural patterns used in the codebase."""
    patterns = []
    
    # Count different types of files
    java_files = sum(1 for path in file_contents.keys() if path.endswith('.java'))
    has_main = any('public static void main' in content for content in file_contents.values())
    has_models = any(any(keyword in os.path.basename(path).lower() 
                        for keyword in ['model', 'entity', 'data']) 
                    for path in file_contents.keys())
    
    patterns.append("### Architectural Patterns Identified:")
    
    if has_main and has_models:
        patterns.append("- **Layered Architecture**: Clear separation between entry point and data models")
    
    if java_files > 1:
        patterns.append("- **Modular Design**: Multiple classes working together for separation of concerns")
    
    # Check for specific patterns
    all_content = ' '.join(file_contents.values()).lower()
    
    if 'extends' in all_content:
        patterns.append("- **Inheritance Pattern**: Uses class inheritance for code reuse")
    
    if 'implements' in all_content:
        patterns.append("- **Interface Pattern**: Implements interfaces for abstraction")
    
    if any('new ' in content for content in file_contents.values()):
        patterns.append("- **Object Composition**: Creates and manages object instances")
    
    return patterns


def _analyze_integration_patterns(file_contents: dict) -> list:
    """Analyze how files integrate and work together."""
    integration = []
    
    integration.append("### Integration Flow:")
    
    # Find main method and trace execution
    main_file = None
    for path, content in file_contents.items():
        if 'public static void main' in content:
            main_file = path
            break
    
    if main_file:
        main_content = file_contents[main_file]
        main_name = os.path.basename(main_file)
        integration.append(f"1. **{main_name}** serves as the application entry point")
        
        # Find object creations
        created_objects = []
        for line in main_content.split('\n'):
            if 'new ' in line and '(' in line:
                # Extract class name from 'new ClassName('
                try:
                    new_index = line.find('new ') + 4
                    paren_index = line.find('(', new_index)
                    class_name = line[new_index:paren_index].strip()
                    if class_name and class_name not in created_objects:
                        created_objects.append(class_name)
                except:
                    pass
        
        if created_objects:
            integration.append(f"2. Creates instances of: {', '.join(created_objects)}")
        
        # Find method calls
        method_calls = []
        for line in main_content.split('\n'):
            if '.' in line and '(' in line and not line.strip().startswith('//'):
                # Look for method calls like obj.method()
                parts = line.split('.')
                if len(parts) > 1:
                    method_part = parts[1].split('(')[0].strip()
                    if method_part and method_part not in method_calls:
                        method_calls.append(method_part)
        
        if method_calls:
            integration.append(f"3. Invokes methods: {', '.join(method_calls[:5])}{'...' if len(method_calls) > 5 else ''}")
    
    integration.append("")
    integration.append("### Data Flow:")
    integration.append("- Objects are created and configured with initial data")
    integration.append("- Methods are called to perform operations and transformations")
    integration.append("- Results are processed and output to console/system")
    
    return integration


def _generate_package_recommendations(file_contents: dict) -> list:
    """Generate recommendations for improving the package."""
    recommendations = []
    
    recommendations.append("### Documentation Recommendations:")
    recommendations.append("1. **Class-level Documentation**: Each class should have comprehensive JavaDoc")
    recommendations.append("2. **Method Documentation**: All public methods need detailed parameter and return documentation")
    recommendations.append("3. **Package Documentation**: Create package-info.java with package overview")
    recommendations.append("4. **Usage Examples**: Include comprehensive usage examples in documentation")
    
    recommendations.append("")
    recommendations.append("### Code Quality Recommendations:")
    
    # Check for common issues
    all_content = ' '.join(file_contents.values())
    
    if 'System.out.println' in all_content:
        recommendations.append("5. **Logging Framework**: Replace System.out.println with proper logging (log4j, slf4j)")
    
    if file_contents and len(file_contents) > 2:
        recommendations.append("6. **Unit Testing**: Add comprehensive unit tests for each class")
    
    recommendations.append("7. **Error Handling**: Implement proper exception handling and validation")
    recommendations.append("8. **Configuration**: Consider externalizing configuration values")
    
    return recommendations

def register_github_integration_tools(mcp):
    """
    Register GitHub integration tools with the MCP server.
    
    Args:
        mcp: FastMCP server instance
    """
    
    @mcp.tool()
    def github_unified_tool(
        repository: str,
        operation: str = Operation.REVIEW.value,
        file_path: str = "",
        branch: str = "main",
        file_extensions: str = ".py,.js,.ts,.java,.cpp,.c,.h",
        max_files: int = 5,
        workflow_type: str = "detailed",
        list_path: str = "",
        commit_message: str = "",
        documented_suffix: str = DEFAULT_DOCUMENTED_SUFFIX,
        reviewed_suffix: str = "_reviewed",
        generated_code: str = "",
        request_text: str = "",
        confirm: str = "no",
        docs_folder: str = ""
    ) -> str:
        """
        GitHub Unified Tool Operations:

        - review: Analyze and review a file. Returns reviewed code and suggestions.
        - review_commit: Commit the reviewed code to the repository with a suffix _reviewed (requires confirm='yes' or 'commit').
        - document: Analyze and document a file. Returns documented code and analysis.
        - document_commit: Commit the documented code to the repository with a suffix _documented (requires confirm='yes' or 'commit').
        - document_directory: Analyze an entire directory and generate batch commands to document all files with comprehensive package analysis.
        - fetch_file: Fetch the raw contents of a file from the repository.
        - auto: Automatically classify intent based on request text.
        - update_file: (Not supported) Use review_commit or document_commit instead.

        Args:
            repository: GitHub repository in format "owner/repo"
            operation: Operation to perform
            file_path: Path to the file in the repository (or directory path for document_directory)
            branch: Branch name (default: "main")
            file_extensions: Comma-separated file extensions for filtering
            max_files: Maximum number of files to process
            workflow_type: Type of workflow ('detailed' or 'summary')
            list_path: Path to list files from
            commit_message: Custom commit message
            documented_suffix: Suffix for documented files (default: "_documented")
            reviewed_suffix: Suffix for reviewed files (default: "_reviewed")
            generated_code: Pre-generated code for commit operations
            request_text: Natural language request for auto operation
            confirm: Confirmation for commit operations ('yes' or 'commit')
            docs_folder: Optional folder to save documentation files (e.g., "docs", "documentation")

        Returns:
            Operation result or error message
        """
        try:
            # Validate operation
            if operation in LEGACY_OPS:
                return f"Error: Operation '{operation}' is deprecated. Use 'review', 'document', 'review_commit', or 'document_commit' instead."
            
            if operation not in ALLOWED_OPS:
                return f"Error: Unknown operation '{operation}'. Valid operations: {', '.join(ALLOWED_OPS)}"
            
            # Parse repository
            parts = repository.split("/")
            if len(parts) != 2:
                return "Error: Repository must be in format 'owner/repo'"
            owner, repo = parts
            
            # Log the operation
            logger.info(json.dumps({
                "event": "github_tool_invoked",
                "operation": operation,
                "repository": repository,
                "file_path": file_path,
                "branch": branch
            }))
            
            # Determine execution mode
            exec_mode = determine_execution_mode(request_text, repository)
            logger.info(f"Execution mode determined: {exec_mode}")
            
            # AUTO operation - classify intent
            if operation == Operation.AUTO.value:
                if not request_text:
                    return "Error: request_text is required for 'auto' operation"
                
                request_lower = request_text.lower()
                if any(word in request_lower for word in ["review", "analyze code", "code quality"]):
                    operation = Operation.REVIEW.value
                elif any(word in request_lower for word in ["document directory", "document folder", "document package", "document all files"]):
                    operation = Operation.DOCUMENT_DIRECTORY.value
                elif any(word in request_lower for word in ["document", "documentation", "docs"]):
                    operation = Operation.DOCUMENT.value
                elif "fetch" in request_lower or "get file" in request_lower:
                    operation = Operation.FETCH.value
                else:
                    return f"Could not determine operation from request. Please use specific operation."
            
            # FETCH FILE operation
            if operation == Operation.FETCH.value:
                if not file_path:
                    return "Error: file_path is required for fetch operation"
                
                content = fetch_github_file_content(owner, repo, file_path, branch)
                if not content:
                    return f"Error: Could not fetch file '{file_path}' from {repository}"
                
                return f"File: {file_path}\n\n{content}"
            
            # REVIEW operation
            if operation == Operation.REVIEW.value:
                if not file_path:
                    return "Error: file_path is required for review operation"
                
                try:
                    content = fetch_github_file_content(owner, repo, file_path, branch)
                    if not content:
                        return f"Error: Could not fetch file '{file_path}' from {repository}"
                except GitHubError as ge:
                    # Handle specific GitHubError (like directory instead of file)
                    if "is a directory" in str(ge):
                        try:
                            # List the contents of the directory to help the user
                            contents = list_repository_contents(owner, repo, file_path, branch)
                            file_list = []
                            for item in contents:
                                if item.get("type") == "file":
                                    file_list.append(item.get("path", ""))
                            
                            if file_list:
                                files_text = "\n".join([f"  - {f}" for f in file_list[:10]])  # Show up to 10 files
                                if len(file_list) > 10:
                                    files_text += f"\n  ... and {len(file_list) - 10} more files"
                                
                                return f"""Error: '{file_path}' is a directory, not a file.

Available files in this directory:
{files_text}

Please specify a specific file path, for example:
operation='review'
file_path='{file_list[0]}'
"""
                            else:
                                return f"Error: '{file_path}' is a directory with no files, or all items are subdirectories."
                        except Exception as list_error:
                            logger.error(f"Failed to list directory contents: {str(list_error)}")
                            return f"Error: '{file_path}' is a directory. Please specify a specific file path within the directory."
                    else:
                        return f"Error: {str(ge)}"
                except Exception as e:
                    return f"Error: Could not fetch file '{file_path}' from {repository}: {str(e)}"
                
                result = code_reviewer_agent(content)
                return result
            
            # REVIEW COMMIT operation
            if operation == Operation.REVIEW_COMMIT.value:
                if not generated_code or not generated_code.strip():
                    return "Error: generated_code is required for review_commit operation"
                
                if confirm.lower() not in ("yes", "commit"):
                    target_name = build_variant_filename(file_path, documented_suffix)
                    analysis_file_preview = f"{os.path.splitext(file_path)[0]}_analysis_{os.path.splitext(file_path)[1].replace('.', '')}.md"
                    return f"Pending commit:\n- Documented file: {target_name}\n- Analysis file: {analysis_file_preview}\nAdd confirm='yes' or confirm='commit' to proceed."
                
                target_name = build_variant_filename(file_path, reviewed_suffix)
                if not commit_message:
                    commit_message = f"Add reviewed version of {file_path}"
                
                # GitHub-only mode for review commit
                try:
                    resp = commit_to_github(owner, repo, target_name, generated_code, commit_message, branch)
                    sha = resp.get('commit', {}).get('sha', 'N/A')
                    logger.info(f"Review committed to GitHub: {target_name}, SHA: {sha}")
                    return f"Successfully committed reviewed code to GitHub: {target_name}\nCommit SHA: {sha}\nMode: GitHub-only (no local files created)"
                except Exception as e:
                    return map_exception(str(e), target_name)
            
            # DOCUMENT operation
            if operation == Operation.DOCUMENT.value:
                if not file_path:
                    return "Error: file_path is required for document operation"
                
                try:
                    content = fetch_github_file_content(owner, repo, file_path, branch)
                    if not content:
                        return f"Error: Could not fetch file '{file_path}' from {repository}"
                except GitHubError as ge:
                    # Handle specific GitHubError (like directory instead of file)
                    if "is a directory" in str(ge):
                        try:
                            # List the contents of the directory to help the user
                            contents = list_repository_contents(owner, repo, file_path, branch)
                            file_list = []
                            for item in contents:
                                if item.get("type") == "file":
                                    file_list.append(item.get("path", ""))
                            
                            if file_list:
                                files_text = "\n".join([f"  - {f}" for f in file_list[:10]])  # Show up to 10 files
                                if len(file_list) > 10:
                                    files_text += f"\n  ... and {len(file_list) - 10} more files"
                                
                                return f"""Error: '{file_path}' is a directory, not a file.

Available files in this directory:
{files_text}

Please specify a specific file path, for example:
operation='document'
file_path='{file_list[0]}'
"""
                            else:
                                return f"Error: '{file_path}' is a directory with no files, or all items are subdirectories."
                        except Exception as list_error:
                            logger.error(f"Failed to list directory contents: {str(list_error)}")
                            return f"Error: '{file_path}' is a directory. Please specify a specific file path within the directory."
                    else:
                        return f"Error: {str(ge)}"
                except Exception as e:
                    return f"Error: Could not fetch file '{file_path}' from {repository}: {str(e)}"
                
                # For GitHub mode, we need repo_info, NOT original_path
                repo_info = {
                    "owner": owner,
                    "repo": repo,
                    "branch": branch,
                    "commit_message": commit_message or f"Add documented and analysis files for {file_path}",
                    "path": file_path,
                    "filename": os.path.basename(file_path)  # Extract filename for proper naming
                }

                # Call generate_documentation correctly
                if file_path.endswith(('.ts', '.tsx')):
                    ts_checklist_prompt = TypeScriptAnalysisHelper.create_instruction(content)
                    enhanced_content = f"""{content}\n\n{ts_checklist_prompt}\n\nProvide a detailed TypeScript implementation analysis showing which best practices are followed (✓) and which are missing (✗).\n"""
                    result = generate_documentation(enhanced_content, repo_info=repo_info)  # Use repo_info!
                else:
                    result = generate_documentation(content, repo_info=repo_info)  # Use repo_info!
                
                # The result already contains both analysis and documented code
                # Just return it as is
                next_step_msg = f"""\n\n=== NEXT STEP ===
                To commit this documented code to GitHub, run:
                operation='document_commit'
                file_path='{file_path}'
                generated_code='<copy the ENTIRE response above including BOTH the analysis AND documented code sections>'
                confirm='yes'
                
                ⚠️  IMPORTANT: Copy the FULL response starting from "### PART 1: COMPREHENSIVE ANALYSIS" 
                through "### PART 2: DOCUMENTED CODE" - this ensures both files are created properly.
                """
                return result + next_step_msg
            
            # DOCUMENT COMMIT operation
            if operation == Operation.DOCUMENT_COMMIT.value:
                # Check for confirmation first
                if confirm.lower() not in ("yes", "commit"):
                    preview_doc = build_variant_filename(file_path, documented_suffix)
                    preview_analysis = f"{os.path.splitext(file_path)[0]}_analysis_{os.path.splitext(file_path)[1].replace('.', '')}.md"
                    return f"""Pending commit:\n- Documented: {preview_doc}\n- Analysis: {preview_analysis}\nAdd confirm='yes' to proceed."""
                
                # Auto-detect and fix common mistakes in file_path
                original_file_path = file_path
                for suffix in ["_documented", "_reviewed", documented_suffix]:
                    if suffix and suffix in file_path:
                        original_file_path = file_path.replace(suffix, "")
                        logger.info(f"Auto-corrected file_path from '{file_path}' to '{original_file_path}'")
                        file_path = original_file_path
                        break
                
                # Use default suffix if not provided
                if not documented_suffix or documented_suffix == "":
                    documented_suffix = DEFAULT_DOCUMENTED_SUFFIX
                    logger.info(f"Using default documented_suffix: {documented_suffix}")
                
                # Handle missing generated_code - AUTO-GENERATE
                if not generated_code or not generated_code.strip():
                    logger.warning("No generated_code provided, attempting to fetch and document automatically")
                    try:
                        content = fetch_github_file_content(owner, repo, file_path, branch)
                        if content:
                            logger.info("Successfully fetched file, generating documentation...")
                            # Call the agent directly since we need the formatted result
                            result = code_documenter_agent(content, include_analysis=True)
                            if result:
                                # Parse the result
                                analysis, documented_code = parse_analysis_and_code(result)
                                if analysis and documented_code:
                                    generated_code = f"=== ANALYSIS ===\n\n{analysis}\n\n=== DOCUMENTED CODE ===\n\n{documented_code}"
                                else:
                                    return f"Error: Failed to parse documentation for '{file_path}'"
                            else:
                                return f"Error: Failed to generate documentation for '{file_path}'"
                        else:
                            return f"Error: Could not fetch '{file_path}' from repository"
                    except GitHubError as ge:
                        # Handle specific GitHubError (like directory instead of file)
                        if "is a directory" in str(ge):
                            try:
                                # List the contents of the directory to help the user
                                contents = list_repository_contents(owner, repo, file_path, branch)
                                file_list = []
                                for item in contents:
                                    if item.get("type") == "file":
                                        file_list.append(item.get("path", ""))
                                
                                if file_list:
                                    files_text = "\n".join([f"  - {f}" for f in file_list[:10]])  # Show up to 10 files
                                    if len(file_list) > 10:
                                        files_text += f"\n  ... and {len(file_list) - 10} more files"
                                    
                                    return f"""Error: '{file_path}' is a directory, not a file.

Available files in this directory:
{files_text}

Please specify a specific file path, for example:
operation='document_commit'
file_path='{file_list[0]}'
confirm='yes'
"""
                                else:
                                    return f"Error: '{file_path}' is a directory with no files, or all items are subdirectories."
                            except Exception as list_error:
                                logger.error(f"Failed to list directory contents: {str(list_error)}")
                                return f"Error: '{file_path}' is a directory. Please specify a specific file path within the directory."
                        else:
                            return f"Error: {str(ge)}"
                    except Exception as e:
                        logger.error(f"Auto-documentation failed: {str(e)}")
                        return f"Error: Auto-documentation failed - {str(e)}"
                
                # Extract analysis and documented code from generated_code
                analysis = None
                documented_code = None
                
                # Log what we're working with
                logger.info(f"Processing generated_code of length: {len(generated_code) if generated_code else 0}")
                if generated_code and len(generated_code) > 100:
                    logger.info(f"Generated code preview: {generated_code[:200]}...")
                
                try:
                    # Use the same parsing function that works in the documentation tool
                    analysis, documented_code = parse_analysis_and_code(generated_code)
                    
                    if analysis and documented_code:
                        logger.info(f"Parsing successful: analysis ({len(analysis)} chars), code ({len(documented_code)} chars)")
                    else:
                        logger.warning("Parsing returned empty results - user may have copied only partial content")
                        logger.warning("Please ensure you copy the FULL response including both analysis and documented code sections")
                        # Fallback: treat entire content as documented code
                        documented_code = generated_code
                        analysis = None
                        
                except Exception as e:
                    logger.error(f"Failed to parse generated_code: {str(e)}")
                    # Fallback: treat entire content as documented code
                    documented_code = generated_code
                    analysis = None
            
                # Validate extracted content
                if documented_code is None:
                    logger.error("documented_code was never assigned a value")
                    return "Error: documented_code is undefined due to earlier failure"
                if not documented_code or len(documented_code.strip()) < 10:
                    logger.error("Extracted documented code is empty or too short")
                    return "Error: Failed to extract valid documented code"
                
                # Log the analysis status
                if analysis and len(analysis.strip()) > 10:
                    logger.info(f"Analysis content ready: {len(analysis)} characters")
                else:
                    logger.warning("No analysis content extracted")
                    analysis = None
                
                # Fix the date in documented code
                if documented_code:
                    import re
                    current_date = datetime.now().strftime('%d/%m/%Y')
                    date_patterns = [
                        (r'Date:\s*\d{2}/\d{2}/\d{4}', f'Date: {current_date}'),
                        (r'//\s*Date:\s*\d{2}/\d{2}/\d{4}', f'// Date: {current_date}'),  # For Java/C++ comments
                    ]
                    for pattern, replacement in date_patterns:
                        documented_code = re.sub(pattern, replacement, documented_code, flags=re.IGNORECASE)
                
                # Create the documented and analysis file paths using new naming function
                logger.info(f"Original file_path: '{file_path}'")
                docs_folder_param = docs_folder if docs_folder.strip() else None
                documented_filename, analysis_filename = build_documentation_paths(
                    file_path, 
                    documented_suffix, 
                    docs_folder_param
                )
                
                logger.info(f"Generated file paths - Documented: '{documented_filename}', Analysis: '{analysis_filename}'")
                logger.info(f"Expected location: Test2/ folder in GitHub repo")
                
                files_to_commit = []
                
                # Create documented file
                files_to_commit.append({
                    "path": documented_filename,
                    "content": documented_code,
                    "message": f"Add documented version of {file_path}"
                })
                
                # Create analysis file if analysis exists
                if analysis and analysis.strip():
                    files_to_commit.append({
                        "path": analysis_filename,
                        "content": analysis,
                        "message": f"Add analysis for {file_path}"
                    })
                    logger.info(f"Prepared for commit: {len(files_to_commit)} files (doc: {documented_filename}, analysis: {analysis_filename})")
                else:
                    logger.warning("No analysis content available - only documented file will be created")
                    logger.warning("To create both files, ensure you copy the FULL response including analysis section")
                    logger.info(f"Prepared for commit: {len(files_to_commit)} files (doc: {documented_filename} only)")
                
                # Commit all files
                try:
                    commit_shas = []
                    for file_info in files_to_commit:
                        commit_result = commit_to_github(
                            owner=owner,
                            repo=repo,
                            path=file_info['path'],  # Correct parameter name
                            content=file_info['content'],
                            message=file_info['message'],  # Correct parameter name
                            branch=branch
                        )
                        if not commit_result or 'sha' not in commit_result.get('commit', {}):
                            logger.error(f"Failed to commit {file_info['path']}")
                            return json.dumps({
                                "event": "document_commit_failed",
                                "error": f"Failed to commit {file_info['path']}",
                                "file": file_info['path']
                            })
                        commit_shas.append({
                            'file': file_info['path'],
                            'sha': commit_result['commit']['sha']
                        })
                        logger.info(f"Committed: {file_info['path']} - SHA: {commit_result['commit']['sha']}")
                    result = {
                        "event": "document_commit_success",
                        "Documented_file": documented_filename,
                        "Analysis_File": analysis_filename,
                        "commits": commit_shas,
                        "mode": "github_only"
                    }
                    logger.info(json.dumps(result))
                    return json.dumps(result, indent=2)
                except Exception as e:
                    logger.error(f"Commit failed: {str(e)}")
                    return json.dumps({
                        "event": "document_commit_failed",
                        "error": str(e)
                    })
                
            # UPDATE FILE (direct update/commit) - NOT SUPPORTED
            if operation == Operation.UPDATE_FILE.value:
                return "Error: The 'update_file' operation is not supported. Please use 'review_commit' or 'document_commit' for code changes."
            
            # DOCUMENT DIRECTORY operation - NEW FEATURE
            if operation == Operation.DOCUMENT_DIRECTORY.value:
                if not file_path:
                    return "Error: file_path (directory path) is required for document_directory operation"
                
                try:
                    # First, create comprehensive analysis of the entire directory
                    logger.info(f"Creating comprehensive analysis for directory: {file_path}")
                    comprehensive_analysis = analyze_directory_structure(owner, repo, file_path, branch)
                    
                    # Get list of files in the directory
                    contents = list_repository_contents(owner, repo, file_path, branch)
                    files = [item for item in contents if item.get("type") == "file"]
                    
                    if not files:
                        return f"Error: No files found in directory '{file_path}'"
                    
                    # Generate individual document_commit commands for each file
                    commands = []
                    commands.append("# Comprehensive Directory Documentation Plan")
                    commands.append(f"# Repository: {repository}")
                    commands.append(f"# Directory: {file_path}")
                    commands.append(f"# Files to document: {len(files)}")
                    commands.append("")
                    
                    # Recommend order (main files last)
                    ordered_files = []
                    main_files = []
                    
                    for file_info in files:
                        file_path_str = str(file_info.get("path", ""))
                        file_name = os.path.basename(file_path_str)
                        if "main" in file_name.lower():
                            main_files.append(file_path_str)
                        else:
                            ordered_files.append(file_path_str)
                    
                    # Add main files at the end
                    ordered_files.extend(main_files)
                    
                    # Generate commands
                    for i, file_path_str in enumerate(ordered_files, 1):
                        file_name = os.path.basename(file_path_str)
                        commands.append(f"# Step {i}: Document {file_name}")
                        commands.append("github_unified_tool(")
                        commands.append(f"    repository='{repository}',")
                        commands.append("    operation='document_commit',")
                        commands.append(f"    file_path='{file_path_str}',")
                        commands.append("    confirm='yes'")
                        commands.append(")")
                        commands.append("")
                    
                    # Combine analysis and commands
                    result_sections = []
                    result_sections.append("# COMPREHENSIVE DIRECTORY ANALYSIS")
                    result_sections.append("")
                    result_sections.append(comprehensive_analysis)
                    result_sections.append("")
                    result_sections.append("=" * 80)
                    result_sections.append("")
                    result_sections.append("# BATCH DOCUMENTATION COMMANDS")
                    result_sections.append("")
                    result_sections.append("Execute these commands in order to document all files:")
                    result_sections.append("")
                    result_sections.extend(commands)
                    
                    return "\n".join(result_sections)
                    
                except GitHubError as ge:
                    return f"Error: {str(ge)}"
                except Exception as e:
                    logger.error(f"Directory documentation failed: {str(e)}")
                    return f"Error: Directory documentation failed - {str(e)}"
            
            return "Error: Unhandled operation state"
            
        except Exception as e:
            logger.error(json.dumps({"event": "tool_failure", "error": str(e)}), exc_info=True)
            return f"❌ GitHub Unified Tool Failed: {str(e)}"
    
    logger.info("********** [TOOLS-API] GitHub integration tools registered (optimized with exclusive modes)")
    logger.info(f"github_unified_tool version: {TOOL_VERSION}")
