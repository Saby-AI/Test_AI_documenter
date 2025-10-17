"""GitHub integration tools for AIVA MCP Server"""

import os
import re
import requests
import base64
from typing import Dict, Any, Optional, List, Union
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import caching system
try:
    import sys
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    utils_path = os.path.abspath(os.path.join(current_dir, '..', '..', 'utils'))
    if utils_path not in sys.path:
        sys.path.insert(0, utils_path)
    from .utils.caching import github_cache
    # Check environment variable
    use_github_token_cache = os.getenv("USE_GITHUB_TOKEN_CACHE", "false").lower() == "true"
    if use_github_token_cache:
        CACHING_AVAILABLE = True
        logger.info("GitHub caching system is enabled by USE_GITHUB_TOKEN_CACHE=true. To use it, make the 'USE_GITHUB_TOKEN_CACHE' flag = True")
    else:
        CACHING_AVAILABLE = False
        logger.info("GitHub caching system is importable but disabled by USE_GITHUB_TOKEN_CACHE!=true")
except ImportError as e:
    CACHING_AVAILABLE = False
    logger.warning(f"GitHub caching system not available: {e}, falling back to direct access")

class GitHubError(Exception):
    pass

class GitHubAuthenticationError(GitHubError):
    pass

class GitHubPermissionError(GitHubError):
    pass

class GitHubNotFoundError(GitHubError):
    pass


def get_github_token() -> str:
    """Get GitHub token with caching support."""
    if CACHING_AVAILABLE:
        token = github_cache.get_or_fetch_token()
        return token or ""
    else:
        return os.getenv("GITHUB_TOKEN", "")


def get_github_headers() -> Dict[str, str]:
    """Get standard GitHub API headers with authentication."""
    token = get_github_token()
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AIVA-MCP-Server"
    }


def github_api_request(url: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Make a request to GitHub API with authentication and proper error handling."""
    default_headers = get_github_headers()
    if headers:
        default_headers.update(headers)

    try:
        logger.info(f"**** Making GitHub API request to {url}")
        response = requests.get(url, headers=default_headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if response.status_code == 401:
            raise GitHubAuthenticationError("#### GitHub Authentication Error: Invalid or expired token.")
        elif response.status_code == 403:
            raise GitHubPermissionError("#### GitHub Permission Error: Access denied.")
        elif response.status_code == 404:
            raise GitHubNotFoundError("#### GitHub Not Found Error: Repository or file not found.")
        else:
            raise GitHubError(f"#### GitHub API Error {response.status_code}: {e}")
    except requests.exceptions.RequestException as e:
        raise GitHubError(f"#### GitHub Connection Error: {e}")

def extract_github_info_from_url(url: str):
    """
    Extract owner, repo, file path, and branch from various GitHub URL formats.
    
    Supported formats:
    - https://github.com/owner/repo/blob/branch/path/to/file.py
    - https://github.com/owner/repo/tree/branch/path/to/folder
    - https://github.com/owner/repo/tree/branch
    - https://github.com/owner/repo
    
    Returns: (owner, repo, path, branch) or (None, None, None, None) if parsing fails.
    """
    logger.info(f"Parsing GitHub URL: {url}")
    
    # Pattern 1: blob URL with file path
    blob_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.*)", url)
    if blob_match:
        owner, repo, branch, path = blob_match.groups()
        logger.info(f"Parsed as blob URL - Owner: {owner}, Repo: {repo}, Branch: {branch}, Path: {path}")
        return owner, repo, path, branch
    
    # Pattern 2: tree URL with folder path
    tree_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.*)", url)
    if tree_match:
        owner, repo, branch, path = tree_match.groups()
        logger.info(f"Parsed as tree URL with path - Owner: {owner}, Repo: {repo}, Branch: {branch}, Path: {path}")
        return owner, repo, path, branch
    
    # Pattern 3: tree URL without specific path
    tree_simple_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/?$", url)
    if tree_simple_match:
        owner, repo, branch = tree_simple_match.groups()
        logger.info(f"Parsed as tree URL - Owner: {owner}, Repo: {repo}, Branch: {branch}, Path: None")
        return owner, repo, None, branch
    
    # Pattern 4: basic repo URL
    repo_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/?$", url)
    if repo_match:
        owner, repo = repo_match.groups()
        logger.info(f"Parsed as basic repo URL - Owner: {owner}, Repo: {repo}, Branch: main, Path: None")
        return owner, repo, None, "main"
    
    logger.warning(f"Could not parse GitHub URL: {url}")
    return None, None, None, None

def fetch_github_file_content(owner: str, repo: str, path: str, branch: str = "main") -> str:
    """
    Fetch the content of a specific file from a GitHub repository.
    
    Args:
        owner: GitHub username or organization name
        repo: Repository name
        path: Path to the file in the repository
        branch: Branch name (default: "main")
    
    Returns:
        The content of the file as a string
    
    Raises:
        GitHubError: If the path points to a directory or other non-file object
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    logger.info(f"**** Fetching file content from {url}")
    data = github_api_request(url)

    # Check if the response is a list (directory) instead of a file
    if isinstance(data, list):
        logger.error(f"#### Path '{path}' is a directory, not a file")
        raise GitHubError(f"Path '{path}' is a directory. Please specify a specific file path within the directory.")
    
    # Check if this is a file object
    if not isinstance(data, dict):
        logger.error(f"#### Unexpected response format for path '{path}'")
        raise GitHubError(f"Unexpected response format for path '{path}'. Expected file object, got {type(data)}")
    
    # Check if it's actually a file
    if data.get("type") != "file":
        file_type = data.get("type", "unknown")
        logger.error(f"#### Path '{path}' is not a file (type: {file_type})")
        raise GitHubError(f"Path '{path}' is not a file (type: {file_type}). Please specify a file path.")

    if data.get("encoding") == "base64":
        try:
            content = base64.b64decode(data["content"]).decode("utf-8")
            logger.info("**** File content fetched and decoded successfully.")
            return content
        except Exception as e:
            logger.error(f"#### Error decoding base64 content: {e}")
            raise
    else:
        logger.warning("#### File content is not base64 encoded.")
        return data.get("content", "")


def list_repository_contents(owner: str, repo: str, path: str = "", branch: str = "main") -> List[Dict[str, Union[str, int]]]:
    """
    List files and directories in a GitHub repository.

    Args:
        owner: GitHub username or organization name
        repo: Repository name
        path: Path within the repository (default: root)
        branch: Branch name (default: "main")

    Returns:
        List of file and directory information
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    logger.info(f"**** Listing repository contents from {url}")
    data = github_api_request(url)

    if not isinstance(data, list):
        logger.error("#### Unexpected response format: Expected a list of items.")
        raise GitHubError("Unexpected response format from GitHub API.")

    files_info = []
    for item in data:
        if isinstance(item, dict):
            files_info.append({
                "name": item.get("name", ""),
                "path": item.get("path", ""),
                "type": item.get("type", ""),  # "file" or "dir"
                "size": item.get("size", 0),
                "download_url": item.get("download_url", "")
            })
        else:
            logger.warning(f"#### Skipping unexpected item format: {item}")

    return files_info


def get_repository_tree(owner: str, repo: str, branch: str = "main", recursive: bool = False) -> list:
    """
    Get the complete tree structure of a repository.
    
    Args:
        owner: GitHub username or organization name
        repo: Repository name
        branch: Branch name (default: "main")
        recursive: Whether to get the full recursive tree
    
    Returns:
        List of all files in the repository
    """
    # First get the commit SHA for the branch
    url = f"https://api.github.com/repos/{owner}/{repo}/branches/{branch}"
    branch_data = github_api_request(url)
    commit_sha = branch_data["commit"]["sha"]
    
    # Get the tree
    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{commit_sha}"
    if recursive:
        tree_url += "?recursive=1"
    
    tree_data = github_api_request(tree_url)
    return tree_data.get("tree", [])


def clean_documented_content(content: str) -> str:
    """
    Clean and normalize documented content for GitHub upload.
    
    Fixes common issues:
    - Converts escaped newlines (\n) back to actual newlines
    - Removes extra formatting and padding
    - Strips malformed JSON-like content
    - Handles Unicode escape sequences
    
    Args:
        content: Raw documented content string
        
    Returns:
        Cleaned content string ready for GitHub upload
    """
    import re
    import json
    
    # If the content looks like it's inside a JSON structure, extract just the content
    if content.strip().startswith('{') and '"documented_content"' in content:
        try:
            # Try to parse as JSON and extract documented_content
            parsed = json.loads(content)
            if isinstance(parsed, dict) and 'documented_content' in parsed:
                content = parsed['documented_content']
        except (json.JSONDecodeError, TypeError):
            # If JSON parsing fails, try to extract content manually
            match = re.search(r'"documented_content":\s*"([^"]*(?:\\.[^"]*)*)"', content, re.DOTALL)
            if match:
                content = match.group(1)
    
    # Convert escaped newlines to actual newlines
    content = content.replace('\\n', '\n')
    
    # Convert escaped quotes
    content = content.replace('\\"', '"')
    
    # Convert escaped backslashes
    content = content.replace('\\\\', '\\')
    
    # Remove extra whitespace and formatting artifacts
    # Remove excessive trailing newlines and spaces
    lines = content.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Skip lines that are just whitespace or formatting artifacts
        if line.strip() and not line.strip().startswith('    \\n'):
            cleaned_lines.append(line.rstrip())
    
    # Remove trailing empty lines but keep structure
    while cleaned_lines and not cleaned_lines[-1].strip():
        cleaned_lines.pop()
    
    # Rejoin the lines
    cleaned_content = '\n'.join(cleaned_lines)
    
    # Final cleanup - remove any remaining escape sequences that shouldn't be there
    cleaned_content = re.sub(r'\\(.)', r'\1', cleaned_content)
    
    return cleaned_content


def commit_to_github(owner: str, repo: str, path: str, content: str, message: str, branch: str = "main") -> Dict[str, Any]:
    """
    Update or create a file in a GitHub repository.
    
    Args:
        owner: GitHub username or organization name
        repo: Repository name
        path: Path to the file in the repository
        content: New content for the file
        message: Commit message
        branch: Branch name (default: "main")
    
    Returns:
        GitHub API response with commit information
    """
    # Clean the content before processing
    content = clean_documented_content(content)
    logger.info(f"Content length after cleaning: {len(content)}")
    
    # First, try to get the current file to get its SHA (needed for updates)
    file_sha = None
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
        file_data = github_api_request(url)
        file_sha = file_data.get("sha")
    except GitHubNotFoundError:
        # File doesn't exist, will create new file
        pass
    except (requests.exceptions.HTTPError, GitHubError) as e:
        # Re-raise other errors (auth, permission, etc.)
        raise
    
    # Prepare the content (GitHub API expects base64 encoded content)
    content_encoded = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    
    # Prepare the update payload
    payload = {
        "message": message,
        "content": content_encoded,
        "branch": branch
    }
    
    # If updating existing file, include the SHA
    if file_sha:
        payload["sha"] = file_sha
    
    # Make the update request
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    headers = get_github_headers()
    headers["Content-Type"] = "application/json"
    
    response = requests.put(url, json=payload, headers=headers)
    response.raise_for_status()
    
    return response.json()
