"""
GitHub Analysis Tool for AIVA MCP Server

This module provides GitHub repository analysis and diagnostic capabilities.
"""

import os
import sys
import logging

# Import github_tools from same directory
from .github_tools import fetch_github_file_content

from .utils.filename_generator import generate_documented_filename, generate_documented_filename_with_versioning, DEFAULT_DOCUMENTED_SUFFIX

logger = logging.getLogger(__name__)

def register_github_analysis_tools(mcp):
    """
    Register GitHub analysis tools with the MCP server.
    
    Args:
        mcp: FastMCP server instance
    """
    
#     @mcp.tool()
#     def check_documented_versions(
#         repository: str,
#         file_path: str,
#         documented_suffix: str = DEFAULT_DOCUMENTED_SUFFIX,
#         branch: str = "main"
#     ) -> str:
#         """
#         Check what documented versions of a file already exist in the repository.
        
#         This tool helps you see existing documented versions before creating a new one.
        
#         Args:
#             repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
#             file_path (str): Path to the original file in the repository
#             documented_suffix (str): Suffix to check for (default: "_documented")
#             branch (str): Branch name to check (default: "main")
        
#         Returns:
#             str: List of existing documented versions and the next available filename
#         """
#         try:
#             # Parse repository string
#             if "/" not in repository:
#                 return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
            
#             owner, repo = repository.split("/", 1)
            
#             logger.info(f"CHECKING DOCUMENTED VERSIONS")
#             logger.info(f"Repository: {repository}")
#             logger.info(f"Original file: {file_path}")
#             logger.info(f"Suffix: {documented_suffix}")
#             logger.info(f"Branch: {branch}")
            
#             # Generate base documented filename
#             base_documented_name = generate_documented_filename(file_path, documented_suffix)
#             # existing_versions = []
            
#             # # Check base version
#             # content = fetch_github_file_content(owner, repo, base_documented_name, branch)
#             # if not content.startswith("Error"):
#             #     existing_versions.append(base_documented_name)
            
#             # Versioned filename checking removed: always overwrite base suffixed file
            
#             # Determine next available name
#             next_available = generate_documented_filename_with_versioning(
#                 owner, repo, file_path, documented_suffix, branch
#             )
            
#             # if existing_versions:
#             #     result = f"""Existing Documented Versions for {file_path}:
# # 
# # Repository: {repository}
# # Branch: {branch}
# # 
# # Found {len(existing_versions)} existing documented version(s):
# # """
# #     for i, version in enumerate(existing_versions, 1):
# #         result += f"  {i}. {version}\n"
# #     result += f"""
# # Next available filename: {next_available}
# # 
# # When you create a new documented version, it will be saved as: {next_available}"""
# # else:
#             result = f"""No Existing Documented Versions Check (Overwriting Mode)

# Repository: {repository}
# Original file: {file_path}
# Branch: {branch}

# Next documented version will be: {next_available}"""
            
#             logger.info(result)
#             return result
            
#         except Exception as e:
#             error_msg = f"Error checking documented versions: {str(e)}"
#             logger.error(error_msg, exc_info=True)
#             return error_msg

    @mcp.tool()
    def test_github_file_existence(
        repository: str,
        file_path: str,
        branch: str = "main"
    ) -> str:
        """
        Test tool to check if a specific file exists in a GitHub repository.
        
        This debugging tool helps verify GitHub API connectivity and file existence checking.
        
        Args:
            repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
            file_path (str): Path to the file to check
            branch (str): Branch name to check (default: "main")
        
        Returns:
            str: Detailed information about the file existence check
        """
        try:
            # Parse repository string
            if "/" not in repository:
                return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
            
            owner, repo = repository.split("/", 1)
            
            logger.info(f"TESTING FILE EXISTENCE")
            logger.info(f"Repository: {repository}")
            logger.info(f"File: {file_path}")
            logger.info(f"Branch: {branch}")
            
            # Test GitHub token
            github_token = os.getenv("GITHUB_TOKEN", "")
            if not github_token:
                return "Error: GITHUB_TOKEN not set in environment variables"
            
            logger.info(f"GitHub token: {'SET (length: ' + str(len(github_token)) + ')' if github_token else 'NOT SET'}")
            
            # Try to fetch the file
            logger.info(f"Attempting to fetch file: {file_path}")
            content = fetch_github_file_content(owner, repo, file_path, branch)
            
            file_exists = not content.startswith("Error")
            
            result = f"""File Existence Test Results:

Repository: {repository}
File: {file_path}
Branch: {branch}

File exists: {file_exists}
Content length: {len(content)} characters
Content preview: {content[:100]}...

Raw result starts with "Error": {content.startswith("Error")}

This helps debug the versioning system. If a file exists but shows as "doesn't exist", 
   there might be an issue with GitHub API permissions or the file path."""
            
            logger.info(result)
            return result
            
        except Exception as e:
            error_msg = f"Error testing file existence: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return error_msg

    @mcp.tool()
    def diagnose_github_permissions(repository: str, branch: str = "main") -> str:
        """
        Comprehensive diagnostic tool for GitHub repository access and permissions.
        
        This tool tests various aspects of GitHub API access to help troubleshoot permission issues.
        
        Args:
            repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
            branch (str): Branch name to test (default: "main")
        
        Returns:
            str: Detailed diagnostic report
        """
        try:
            # Parse repository string
            if "/" not in repository:
                return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
            
            owner, repo = repository.split("/", 1)
            
            logger.info(f"GITHUB PERMISSIONS DIAGNOSTIC")
            logger.info(f"Repository: {repository}")
            logger.info(f"Branch: {branch}")
            
            # Test GitHub token
            github_token = os.getenv("GITHUB_TOKEN", "")
            if not github_token:
                return "Error: GITHUB_TOKEN not set in environment variables"
            
            diagnostic_results = []
            
            # Test 1: Token format
            if github_token.startswith("ghp_"):
                diagnostic_results.append("Token format: Valid personal access token")
            elif github_token.startswith("github_pat_"):
                diagnostic_results.append("Token format: Valid fine-grained personal access token")
            else:
                diagnostic_results.append("Warning: Token format: Unusual token format, may be invalid")
            
            # Test 2: Repository access
            test_files = ["README.md", "readme.md", "README.rst", "README.txt", ".gitignore"]
            access_test_passed = False
            
            for test_file in test_files:
                try:
                    logger.info(f"Testing access with file: {test_file}")
                    content = fetch_github_file_content(owner, repo, test_file, branch)
                    if not content.startswith("Error"):
                        diagnostic_results.append(f"Repository access: Successfully accessed {test_file}")
                        access_test_passed = True
                        break
                except Exception as e:
                    continue
            
            if not access_test_passed:
                # Try to get more specific error by testing repository root
                try:
                    content = fetch_github_file_content(owner, repo, "non-existent-file.txt", branch)
                    if "403" in content:
                        diagnostic_results.append("Repository access: 403 Forbidden - Token lacks permissions")
                    elif "404" in content and "Repository" in content:
                        diagnostic_results.append("Repository access: Repository not found or no access")
                    else:
                        diagnostic_results.append("Repository access: Unable to access repository")
                except Exception as e:
                    diagnostic_results.append(f"Repository access: Connection error - {str(e)}")
            
            # Test 3: Branch access
            try:
                content = fetch_github_file_content(owner, repo, ".git", branch)
                if "404" in content and not "403" in content:
                    diagnostic_results.append(f"Branch access: Branch '{branch}' exists and is accessible")
                elif "403" in content:
                    diagnostic_results.append(f"Branch access: No permission to access branch '{branch}'")
            except Exception as e:
                diagnostic_results.append(f"Warning: Branch access: Could not verify branch access")
            
            # Compile report
            result = f"""GitHub Permissions Diagnostic Report

Repository: {repository}
Branch: {branch}
Token length: {len(github_token)} characters

Test Results:
"""
            for i, result_line in enumerate(diagnostic_results, 1):
                result += f"  {i}. {result_line}\n"
            
            result += f"""
Troubleshooting Tips:

For Private Repositories:
- Ensure your token has 'repo' scope (full repository access)
- Token must be associated with an account that has access to the repository

For Organization Repositories:
- Check if the organization requires token approval
- Ensure your token has organization permissions

Common Solutions:
1. Regenerate your GitHub token with 'repo' scope
2. Check repository name spelling and case sensitivity
3. Verify you have access to the repository in GitHub web interface
4. For organizations: Ask admin to approve your token access

GitHub Token Scopes Required:
- 'repo' (for private repositories)
- 'public_repo' (for public repositories only)"""
            
            logger.info(result)
            return result
            
        except Exception as e:
            error_msg = f"Error running GitHub diagnostic: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return error_msg

    logger.info("********** [TOOLS-API] GitHub analysis tools registered")
