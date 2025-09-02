""" Azure AI Agent Service MCP Server """

import os
import time
import subprocess
import json
import shutil
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from fastapi import Response
from azure.ai.projects import AIProjectClient
from azure.core.credentials import AccessToken
from github_tools import fetch_github_file_content, list_repository_contents, get_repository_tree, update_github_file
from datetime import datetime
import logging
from azure.identity import DefaultAzureCredential
import sys

# Configure logging to separate error logs to a file and info logs to the console
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Avoid adding duplicate handlers by checking for existing handlers
if not any(isinstance(handler, logging.FileHandler) for handler in logger.handlers):
    file_handler = logging.FileHandler('server_errors.log', encoding='utf-8')
    file_handler.setLevel(logging.ERROR)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)

if not any(isinstance(handler, logging.StreamHandler) for handler in logger.handlers):
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(console_handler)

class AzureCredentialManager:
    """
    Manages Azure authentication using DefaultAzureCredential.
    """
    def get_token(self, *scopes, **kwargs):
        try:
            credential = DefaultAzureCredential()
            token = credential.get_token(*scopes)
            return token
        except Exception as e:
            logger.error(f"Failed to get token: {e}")
            raise

load_dotenv()

# Constants
MAX_VERSION_LIMIT = 20
DEFAULT_DOCUMENTED_SUFFIX = "_documented"
AZURE_RESOURCE_URL = "https://ai.azure.com"
WINDOWS_AZ_CLI_PATH = r'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'

logger.info("Initializing Encora AIVA MCP Server...")
logger.info(f"PROJECT_ENDPOINT: {os.getenv('PROJECT_ENDPOINT_STRING', 'NOT SET')}")
logger.info(f"GITHUB_TOKEN: {'SET' if os.getenv('GITHUB_TOKEN') else 'NOT SET'}")

mcp = FastMCP(
    name="Encora AIVA MCP Server",
    instructions="This MCP server integrates with Azure AI Agent Service to handle Encora AIVA agentic workflows."
)

PROJECT_ENDPOINT_STRING = os.getenv("PROJECT_ENDPOINT_STRING", "")
    
today = datetime.now().strftime("%d/%m/%Y")

@mcp.tool()
def code_documenter_agent(prompt: str) -> str:
    """
    Forward a user's code snippet or request to the Code Documenter Agent.

    This tool passes the given prompt (which should contain source code in any supported 
    programming language) directly to the preconfigured Code Documenter Agent.
    The agent is responsible for generating this output:      
      1. A commented version of the original code, with inline explanations. 
        At the top of the code file, put the Date: {today}, user (use 'Agentic_AI_System_Documenter' if user details are not available), and code language, using the correct comment syntax for the language.

    The agent already has access to a guidelines knowledge base (via vector store) and must have to follow the guidelines from that knowledge base that 
    defines documentation standards, commenting style, formatting rules, and tone.
    
    Args:
        prompt (str): A natural language request from the user, usually containing source code,
                      such as:
                      - "Document this Python function ..."
                      - "Generate documentation for this Java class ..."
                      - "Add inline comments and Markdown docs for this code ..."

    Returns:
        str: The final response from the Code Documenter Agent, including both the 
             Markdown documentation and the documented code. If the run fails, 
             an error message is returned.
    """
    try:
        logger.info("Starting code documentation process...")
        logger.info(f"Prompt length: {len(prompt)} characters")

        agent_id = os.getenv("AGENT_ID_CODE_DOCUMENTER", "")
        if not agent_id:
            logger.error("Error: AGENT_ID_CODE_DOCUMENTER not set in environment variables")
            return "Error: AGENT_ID_CODE_DOCUMENTER not set in environment variables"

        if not PROJECT_ENDPOINT_STRING:
            logger.error("Error: PROJECT_ENDPOINT_STRING not set in environment variables")
            return "Error: PROJECT_ENDPOINT_STRING not set in environment variables"

        logger.info(f"Connecting to Azure AI Project: {PROJECT_ENDPOINT_STRING}")
        ai_client = AIProjectClient(
            endpoint=PROJECT_ENDPOINT_STRING,
            credential=AzureCredentialManager()
        )

        with ai_client:
            logger.info("Connected to Azure AI Project")
            thread = ai_client.agents.threads.create()
            logger.info(f"Created thread: {thread.id}")

            ai_client.agents.messages.create(thread_id=thread.id, role="user", content=prompt)
            logger.info("Message sent to agent")

            run = ai_client.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent_id)
            logger.info(f"Run started: {run.id}, status: {run.status}")

            while run.status in ["queued", "in_progress", "requires_action"]:
                logger.info(f"Run status: {run.status}")
                time.sleep(2)
                run = ai_client.agents.runs.get(thread_id=run.thread_id, run_id=run.id)

            logger.info(f"Run completed with status: {run.status}")

            if run.status == "failed":
                error_msg = f"Run failed: {run.last_error}"
                logger.error(error_msg)
                return error_msg
            else:
                messages = ai_client.agents.messages.list(thread_id=thread.id, order="desc", limit=1)
                message = next(iter(messages), None)
                if message and message.text_messages:
                    result = message.text_messages[-1].text.value
                    logger.info(f"Documentation generated successfully ({len(result)} characters)")
                    return result
                else:
                    logger.warning("No message with text found.")
                    return "No response received from the agent"

    except Exception as e:
        error_msg = f"Error calling Code Documenter Agent: {str(e)}"
        logger.error(error_msg)
        return error_msg

@mcp.tool()
def github_unified_tool(
    repository: str, 
    operation: str = "document_file",
    file_path: str = "",
    branch: str = "main", 
    file_extensions: str = ".py,.js,.ts,.java,.cpp,.c,.h",
    max_files: int = 5,
    workflow_type: str = "detailed",
    list_path: str = "",
    commit_message: str = "",
    auto_commit: bool = False,
    create_new_file: bool = True,
    documented_suffix: str = DEFAULT_DOCUMENTED_SUFFIX
) -> str:
    """
    Unified GitHub tool that combines all GitHub operations: fetch files, document code, and optionally commit changes.
    This function chains multiple agents sequentially based on the specified operation.
    
    Operations:
    - "fetch_file": Fetch a specific file from GitHub repository    
    - "document_file": Fetch and document a single file with agent chaining
    - "document_and_commit": Fetch, document, and commit the documented file back to repository
    
    Args:
        repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
        operation (str): Operation to perform (default: "document_file")
        file_path (str): Path to the file in the repository (required for file operations)
        branch (str): Branch name (default: "main")
        commit_message (str): Custom commit message for updates (auto-generated if empty)
        auto_commit (bool): Whether to automatically commit changes (default: False, requires user confirmation)
        create_new_file (bool): Whether to create a new documented file instead of overwriting (default: True)
        documented_suffix (str): Suffix to add to the filename for new documented files (default: "_documented")
    
    Returns:
        str: Result based on operation - file content, documentation, or commit confirmation
    """
    try:
        agent_id = os.getenv("AGENT_ID_GITHUB_DOCUMENTER", "")
        logger.info(f"Agent ID: {agent_id}")

        # Validate required environment variables
        if not agent_id:
            return "Error: AGENT_ID_GITHUB_DOCUMENTER not set in environment variables"
        
        if not PROJECT_ENDPOINT_STRING:
            return "Error: PROJECT_ENDPOINT_STRING not set in environment variables"
        
        github_token = os.getenv("GITHUB_TOKEN", "")
        if not github_token:
            return "Error: GITHUB_TOKEN not set in environment variables"

        # Parse repository string
        if "/" not in repository:
            return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
        
        owner, repo = repository.split("/", 1)
        
        # Test GitHub access before proceeding
        try:
            logger.info(f"Testing GitHub access to repository {repository}...")
            test_content = fetch_github_file_content(owner, repo, "README.md", branch)
            if test_content.startswith("Error") and "403" in test_content:
                return f"""GitHub Permission Error: Unable to access repository '{repository}'.

Common issues:
1. **Private Repository**: Your GitHub token may not have access to this private repository
2. **Token Permissions**: Your token needs 'repo' scope for private repositories
3. **Organization Access**: If this is an organization repository, the token may need organization permissions

To fix this:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a new token with 'repo' scope (for private repositories)
3. Update your GITHUB_TOKEN environment variable

Current token length: {len(github_token)} characters
Repository: {repository}
Branch: {branch}"""
            elif test_content.startswith("Error") and "404" in test_content:
                return f"""Repository Not Found: '{repository}' could not be found.

Please check:
1. Repository name is correct (format: owner/repo)
2. Repository exists and is accessible
3. Branch name is correct (current: {branch})

Repository: {repository}
Branch: {branch}"""
            else:
                logger.info(f"GitHub access test successful")
        except Exception as e:
            return f"GitHub Connection Error: {str(e)}"
        
        logger.info(f"GITHUB UNIFIED TOOL STARTED")
        logger.info(f"Operation: {operation}")
        logger.info(f"Repository: {repository}")
        logger.info(f"Branch: {branch}")
        
        # === OPERATION: FETCH FILE ===
        if operation == "fetch_file":
            if not file_path:
                return "Error: file_path is required for fetch_file operation"
            
            logger.info(f"Fetching file: {file_path}")
            content = fetch_github_file_content(owner, repo, file_path, branch)
            logger.info(f"File fetched successfully ({len(content)} characters)")
            return content             
        
        # === OPERATION: DOCUMENT SINGLE FILE ===
        elif operation == "document_file":
            if not file_path:
                return "Error: file_path is required for document_file operation"
            
            logger.info(f"AGENT CHAIN STARTED - Document Single File")
            logger.info(f"Step 1: GitHub Agent - Fetching file: {file_path}")
            
            # STEP 1: Fetch the code from GitHub
            code_content = fetch_github_file_content(owner, repo, file_path, branch)
            logger.info(f"Step 1 Complete: Fetched file content ({len(code_content)} characters)")
            
            if code_content.startswith("Error"):
                logger.error(f"GitHub Agent failed: {code_content}")
                return code_content
            
            logger.info(f"Step 2: Documentation Agent - Processing code...")
            # STEP 2: Create enhanced prompt for documentation
            prompt = (
                f"""CRITICAL INSTRUCTION: You must return ONLY the source code with added documentation. Do NOT provide analysis, descriptions, or explanations about the code.

TASK: Add comprehensive inline documentation to this source code from {repository}/{file_path}

REQUIRED OUTPUT FORMAT: Return the complete source code with the following additions:

1. At the top of the code file, add a header comment with Date: {today}, user (use 'Agentic_AI_System_Documenter' if user details are not available), and code language, using the correct comment syntax for the language.

2. For every function and class, provide detailed documentation immediately inside the function or class definition, following the language's documentation best practices.

3. Add inline comments above complex code sections for clarity.

4. CRITICAL: Return ONLY the documented source code. Do NOT include:
   - Analysis or explanations about what the code does
   - Markdown formatting or code blocks (```)
   - Separate documentation sections
   - Summary or overview text

5. Use the appropriate documentation syntax for each language:
   - Python: Use triple-quoted strings (\"\"\" ... \"\"\") for docstrings
   - Java/C/C++: Use /* ... */ for block comments
   - JavaScript: Use /** ... */ for JSDoc comments

6. The output must be valid source code that can be directly saved to a file.

EXAMPLE OUTPUT FORMAT:
For Python code, return something like this structure:
\"\"\"
Date: {today}
User: Agentic_AI_System_Documenter
Code Language: Python
\"\"\"

import statements...

def function_name():
    \"\"\"
    Function description here.
    Args: parameter descriptions
    Returns: return value description
    \"\"\"
    # Inline comment about complex logic
    code here...
    
7. DO NOT Skip any CODE.

SOURCE CODE TO DOCUMENT:
{code_content}

REMEMBER: Return ONLY the documented source code, nothing else."""
            )
            
            logger.info(f"Calling Documentation Agent with enhanced prompt ({len(prompt)} characters)")
            
            # STEP 2: Call the Documentation Agent
            result = code_documenter_agent(prompt)
            
            logger.info(f"Step 2 Complete: Documentation generated ({len(result)} characters)")
            logger.info(f"AGENT CHAIN COMPLETED SUCCESSFULLY")
            
            return f"# Documentation for {repository}/{file_path}\n\n{result}"
        
        # === OPERATION: DOCUMENT AND COMMIT ===
        elif operation == "document_and_commit":
            if not file_path:
                return "Error: file_path is required for document_and_commit operation"
            
            # Determine the target file path
            if create_new_file:
                target_file_path = generate_documented_filename_with_versioning(
                    owner, repo, file_path, documented_suffix, branch
                )
                logger.info(f"EXTENDED AGENT CHAIN STARTED - Document and Create New File")
                logger.info(f"Original file: {file_path}")
                logger.info(f"New documented file: {target_file_path}")
                
                # Check if we're using a versioned name
                base_name = generate_documented_filename(file_path, documented_suffix)
                if target_file_path != base_name:
                    logger.info(f"File {base_name} already exists, using versioned name: {target_file_path}")
            else:
                target_file_path = file_path
                logger.info(f"EXTENDED AGENT CHAIN STARTED - Document and Overwrite File")
                logger.info(f"Target file: {target_file_path}")
            
            logger.info(f"Step 1: GitHub Agent - Fetching original file: {file_path}")
            
            # STEP 1: Fetch the code from GitHub
            code_content = fetch_github_file_content(owner, repo, file_path, branch)
            logger.info(f"Step 1 Complete: Fetched file content ({len(code_content)} characters)")
            
            if code_content.startswith("Error"):
                logger.error(f"GitHub Agent failed: {code_content}")
                return code_content
            
            logger.info(f"Step 2: Documentation Agent - Processing code...")
            # STEP 2: Create enhanced prompt for documentation (same as before)
            prompt = (
                f"""CRITICAL INSTRUCTION: You must return ONLY the source code with added documentation. Do NOT provide analysis, descriptions, or explanations about the code.

TASK: Add comprehensive inline documentation to this source code from {repository}/{file_path}

REQUIRED OUTPUT FORMAT: Return the complete source code with the following additions:

1. At the top of the code file, add a header comment with Date: {today}, user (use 'Agentic_AI_System_Documenter' if user details are not available), and code language, using the correct comment syntax for the language.

2. For every function and class, provide detailed documentation immediately inside the function or class definition, following the language's documentation best practices.

3. Add inline comments above complex code sections for clarity.

4. CRITICAL: Return ONLY the documented source code. Do NOT include:
   - Analysis or explanations about what the code does
   - Markdown formatting or code blocks (```)
   - Separate documentation sections
   - Summary or overview text

5. Use the appropriate documentation syntax for each language:
   - Python: Use triple-quoted strings (\"\"\" ... \"\"\") for docstrings
   - Java/C/C++: Use /* ... */ for block comments
   - JavaScript: Use /** ... */ for JSDoc comments

6. The output must be valid source code that can be directly saved to a file.

7. DO NOT Skip any CODE.

SOURCE CODE TO DOCUMENT:
{code_content}

REMEMBER: Return ONLY the documented source code, nothing else."""
            )
            
            logger.info(f"Calling Documentation Agent with enhanced prompt ({len(prompt)} characters)")
            
            # STEP 2: Call the Documentation Agent
            documented_code = code_documenter_agent(prompt)
            
            logger.info(f"Step 2 Complete: Documentation generated ({len(documented_code)} characters)")
            
            if auto_commit:
                logger.info(f"Step 3: Committing documented code to repository...")
                
                # Generate default commit message if not provided
                if not commit_message:
                    if create_new_file:
                        commit_message = f"Create documented version of {file_path} as {target_file_path} via AIVA Agent"
                    else:
                        commit_message = f"Add documentation to {file_path} via AIVA Agent"
                
                # STEP 3: Commit the documented code back to GitHub
                try:
                    update_result = update_github_file(
                        owner=owner,
                        repo=repo,
                        path=target_file_path,  # Use the target path (original or new)
                        content=documented_code,
                        message=commit_message,
                        branch=branch
                    )
                    
                    commit_sha = update_result.get("commit", {}).get("sha", "unknown")
                    commit_url = update_result.get("commit", {}).get("html_url", "")
                    
                    if create_new_file:
                        success_msg = f"""COMPLETE WORKFLOW FINISHED SUCCESSFULLY!

Repository: {repository}
Original file: {file_path}
New documented file: {target_file_path}
Branch: {branch}
Commit: {commit_message}
Commit SHA: {commit_sha}
Commit URL: {commit_url}

A new documented version of the file has been created and committed to the repository."""
                    else:
                        success_msg = f"""COMPLETE WORKFLOW FINISHED SUCCESSFULLY!

Repository: {repository}
File: {target_file_path}
Branch: {branch}
Commit: {commit_message}
Commit SHA: {commit_sha}
Commit URL: {commit_url}

The file has been documented and committed to the repository."""

                    logger.info(f"Step 3 Complete: File committed successfully")
                    logger.info(f"EXTENDED AGENT CHAIN COMPLETED SUCCESSFULLY")
                    return success_msg
                    
                except Exception as e:
                    error_msg = f"Step 3 Failed - Commit error: {str(e)}"
                    logger.error(error_msg)
                    return f"{error_msg}\n\nDocumented code was generated successfully but could not be committed:\n\n{documented_code}"
            else:
                # Return documentation with instructions for manual commit
                logger.info(f"DOCUMENTATION CHAIN COMPLETED - Manual commit required")
                if create_new_file:
                    return f"""# Documentation Generated for {repository}/{file_path}

**USER CONFIRMATION REQUIRED** - The code has been documented but not yet committed.

**Original file**: {file_path}
**New documented file**: {target_file_path}

To commit these changes, you can:
1. Use the `github_update_file_tool` with the documented content below
2. Set `auto_commit=true` in the next call to automatically commit
3. Manually copy the documented code and commit it yourself

## Documented Code:
{documented_code}

## To commit automatically, call:
`github_update_file_tool(repository="{repository}", file_path="{target_file_path}", documented_content="<the_code_above>", commit_message="Create documented version of {file_path} as {target_file_path}")`"""
                else:
                    return f"""# Documentation Generated for {repository}/{file_path}

**USER CONFIRMATION REQUIRED** - The code has been documented but not yet committed.

To commit these changes, you can:
1. Use the `github_update_file_tool` with the documented content below
2. Set `auto_commit=true` in the next call to automatically commit
3. Manually copy the documented code and commit it yourself

## Documented Code:
{documented_code}

## To commit automatically, call:
`github_update_file_tool(repository="{repository}", file_path="{file_path}", documented_content="<the_code_above>", commit_message="Your custom message")`"""        
        
        else:
            return f"Error: Unknown operation '{operation}'. Supported operations: fetch_file, document_file, document_and_commit"
        
    except Exception as e:
        error_msg = f"GitHub Unified Tool Failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return error_msg

@mcp.tool()
def github_update_file_tool(
    repository: str,
    file_path: str,
    documented_content: str,
    commit_message: str = "",
    branch: str = "main"
) -> str:
    """
    Update a file in a GitHub repository with documented code after user confirmation.
    
    This tool allows you to commit documented code back to the GitHub repository.
    Use this after generating documentation and getting user confirmation.
    
    Args:
        repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
        file_path (str): Path to the file in the repository to update
        documented_content (str): The documented code content to commit
        commit_message (str): Custom commit message (default: auto-generated)
        branch (str): Branch name to commit to (default: "main")
    
    Returns:
        str: Success message with commit details or error message
    """
    try:
        # Parse repository string
        if "/" not in repository:
            return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
        
        owner, repo = repository.split("/", 1)
        
        # Generate default commit message if not provided
        if not commit_message:
            commit_message = f"Add documentation to {file_path} via AIVA Agent"
        
        logger.info(f"GITHUB UPDATE FILE TOOL STARTED")
        logger.info(f"Repository: {repository}")
        logger.info(f"File: {file_path}")
        logger.info(f"Branch: {branch}")
        logger.info(f"Commit message: {commit_message}")
        
        # Update the file in GitHub
        result = update_github_file(
            owner=owner,
            repo=repo,
            path=file_path,
            content=documented_content,
            message=commit_message,
            branch=branch
        )
        
        commit_sha = result.get("commit", {}).get("sha", "unknown")
        commit_url = result.get("commit", {}).get("html_url", "")
        
        success_msg = f"""File successfully updated in GitHub!

Repository: {repository}
File: {file_path}
Branch: {branch}
Commit: {commit_message}
Commit SHA: {commit_sha}
Commit URL: {commit_url}

The documented code has been committed to the repository."""

        logger.info(success_msg)
        return success_msg
        
    except Exception as e:
        error_msg = f"GitHub Update Failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return error_msg

def generate_documented_filename(original_path: str, suffix: str = DEFAULT_DOCUMENTED_SUFFIX) -> str:
    """
    Generate a new filename with the documented suffix.
    
    Args:
        original_path (str): Original file path (e.g., "server.py" or "src/utils.js")
        suffix (str): Suffix to add before the file extension (default: "_documented")
    
    Returns:
        str: New filename with suffix (e.g., "server_documented.py" or "src/utils_documented.js")
    """
    if "." in original_path:
        # Split path and extension
        path_without_ext, extension = original_path.rsplit(".", 1)
        return f"{path_without_ext}{suffix}.{extension}"
    else:
        # No extension, just add suffix
        return f"{original_path}{suffix}"


def generate_documented_filename_with_versioning(
    owner: str, 
    repo: str, 
    original_path: str, 
    suffix: str = DEFAULT_DOCUMENTED_SUFFIX,
    branch: str = "main"
) -> str:
    """
    Generate a new filename with the documented suffix.
    
    Always returns the base documented filename (e.g., "server_documented.py") 
    without version numbers, allowing overwriting of existing documented files.
    
    Args:
        owner (str): GitHub repository owner
        repo (str): GitHub repository name
        original_path (str): Original file path (e.g., "server.py" or "src/utils.js")
        suffix (str): Suffix to add before the file extension (default: "_documented")
        branch (str): Branch name (not used in current implementation but kept for compatibility)
    
    Returns:
        str: Filename with suffix (e.g., "server_documented.py")
    """
    logger.info(f"FILENAME GENERATION: Starting for {original_path}")
    
    # Generate base documented filename
    base_documented_name = generate_documented_filename(original_path, suffix)
    logger.info(f"FILENAME GENERATION: Using base documented name: {base_documented_name}")
    logger.info(f"Note: Will overwrite existing documented file if it exists")
    
    return base_documented_name


@mcp.tool()
def check_documented_versions(
    repository: str,
    file_path: str,
    documented_suffix: str = DEFAULT_DOCUMENTED_SUFFIX,
    branch: str = "main"
) -> str:
    """
    Check what documented versions of a file already exist in the repository.
    
    This tool helps you see existing documented versions before creating a new one.
    
    Args:
        repository (str): GitHub repository in format "owner/repo" (e.g., "microsoft/vscode")
        file_path (str): Path to the original file in the repository
        documented_suffix (str): Suffix to check for (default: "_documented")
        branch (str): Branch name to check (default: "main")
    
    Returns:
        str: List of existing documented versions and the next available filename
    """
    try:
        # Parse repository string
        if "/" not in repository:
            return "Error: Repository must be in format 'owner/repo' (e.g., 'microsoft/vscode')"
        
        owner, repo = repository.split("/", 1)
        
        logger.info(f"CHECKING DOCUMENTED VERSIONS")
        logger.info(f"Repository: {repository}")
        logger.info(f"Original file: {file_path}")
        logger.info(f"Suffix: {documented_suffix}")
        logger.info(f"Branch: {branch}")
        
        # Generate base documented filename
        base_documented_name = generate_documented_filename(file_path, documented_suffix)
        existing_versions = []
        
        # Check base version
        from github_tools import fetch_github_file_content
        content = fetch_github_file_content(owner, repo, base_documented_name, branch)
        if not content.startswith("Error"):
            existing_versions.append(base_documented_name)
        
        # Check numbered versions
        if "." in base_documented_name:
            path_without_ext, extension = base_documented_name.rsplit(".", 1)
        else:
            path_without_ext = base_documented_name
            extension = ""
        
        version = 1
        while version <= MAX_VERSION_LIMIT:  # Check up to maximum version limit
            if extension:
                versioned_name = f"{path_without_ext}_{version}.{extension}"
            else:
                versioned_name = f"{path_without_ext}_{version}"
            
            version_content = fetch_github_file_content(owner, repo, versioned_name, branch)
            if not version_content.startswith("Error"):
                existing_versions.append(versioned_name)
                version += 1
            else:
                break
        
        # Determine next available name
        next_available = generate_documented_filename_with_versioning(
            owner, repo, file_path, documented_suffix, branch
        )
        
        if existing_versions:
            result = f"""Existing Documented Versions for {file_path}:

Repository: {repository}
Branch: {branch}

Found {len(existing_versions)} existing documented version(s):
"""
            for i, version in enumerate(existing_versions, 1):
                result += f"  {i}. {version}\n"
            
            result += f"""
Next available filename: {next_available}

When you create a new documented version, it will be saved as: {next_available}"""
        else:
            result = f"""No Existing Documented Versions Found

Repository: {repository}
Original file: {file_path}
Branch: {branch}

No documented versions exist yet for this file.

Next documented version will be: {next_available}"""
        
        logger.info(result)
        return result
        
    except Exception as e:
        error_msg = f"Error checking documented versions: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return error_msg


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
        from github_tools import fetch_github_file_content
        
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
        from github_tools import fetch_github_file_content
        
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


# Ensure all unhandled exceptions are logged to the file

def log_unhandled_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        # Allow keyboard interrupts to exit cleanly
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    logger.error("Unhandled exception", exc_info=(exc_type, exc_value, exc_traceback))

# Set the global exception hook
sys.excepthook = log_unhandled_exception

# === Start MCP ===
if __name__ == "__main__":
    try:
        logger.info("Starting Encora AIVA MCP Server...")
        logger.info("Available tools:")
        logger.info("   • code_documenter_agent - Document code using AI agents")
        logger.info("   • github_unified_tool - Fetch, document, and commit GitHub files")
        logger.info("   • github_update_file_tool - Update GitHub files with documented code")
        logger.info("   • check_documented_versions - Check existing documented versions")
        logger.info("   • test_github_file_existence - Test GitHub API connectivity and file existence")
        logger.info("   • diagnose_github_permissions - Comprehensive GitHub permissions diagnostic")
        logger.info("Starting FastMCP server with SSE transport for LibreChat...")
        
        # Run FastMCP server with SSE transport for LibreChat, listening on all interfaces
        mcp.run(transport="sse")
        
    except Exception as e:
        logger.error(f"Error starting MCP server: {e}", exc_info=True)
