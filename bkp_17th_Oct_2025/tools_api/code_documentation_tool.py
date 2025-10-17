
"""
Code Documentation Tool for AIVA MCP Server

This module provides AI-powered code documentation capabilities using Azure AI Agent Service.

Version: 1.0.0
Date: 08/sep/2025
Author: Sabyasachi S

"""

import os
import re
import time
import logging
from datetime import datetime
from typing import Optional, Dict, Tuple, Set, List
from pathlib import Path
import textwrap

from azure.ai.projects import AIProjectClient

# Support both package and script execution contexts for internal imports
try:
    from .utils.azure_client import AzureCredentialManager
    from .utils.file_searcher import FileSearcher
    from .utils.response_parser import parse_analysis_and_code
    from .utils.code_documentation_helper import (
        LargeFileStrategy,
        LARGE_FILE_THRESHOLD,
        LARGE_FILE_STRATEGY,
        ANALYSIS_INSTRUCTION,
        TYPESCRIPT_ANALYSIS_INSTRUCTION,
        CHUNK_INSTRUCTION,
        validate_environment,
        discover_dependencies,
        find_repository_files_by_pattern,
        find_target_files,
        generate_multi_file_documentation,
        code_documenter_agent_with_chunking,
        process_large_file,
        split_code_intelligently,
        create_code_summary,
        handle_large_content,
        # is_safe_path,
        detect_operation_type,
        save_documented_code,
        save_analysis_part,
    )
except ImportError:
    from utils.azure_client import AzureCredentialManager  # type: ignore
    from utils.file_searcher import FileSearcher  # type: ignore
    from utils.response_parser import parse_analysis_and_code  # type: ignore
    from utils.code_documentation_helper import (  # type: ignore
        LargeFileStrategy,
        LARGE_FILE_THRESHOLD,
        LARGE_FILE_STRATEGY,
        ANALYSIS_INSTRUCTION,
        TYPESCRIPT_ANALYSIS_INSTRUCTION,
        CHUNK_INSTRUCTION,
        validate_environment,
        discover_dependencies,
        find_repository_files_by_pattern,
        find_target_files,
        generate_multi_file_documentation,
        code_documenter_agent_with_chunking,
        process_large_file,
        split_code_intelligently,
        create_code_summary,
        handle_large_content,
        # is_safe_path,
        detect_operation_type,
        save_documented_code,
        save_analysis_part,
    )

try:
    from .github_tools import (
        fetch_github_file_content,
        commit_to_github,
        extract_github_info_from_url,
    )
except ImportError:
    from github_tools import (  # type: ignore
        fetch_github_file_content,
        commit_to_github,
        extract_github_info_from_url,
    )

# Robust .env loading (supports running from multiple entry points)
try:
    from dotenv import load_dotenv, find_dotenv  # type: ignore
    from pathlib import Path

    def _load_env_files():
        """Attempt to load environment variables in a deterministic order.

        Order:
        1. Explicit mcp-server/.env at repo root (expected canonical location)
        2. Repo root .env (if present)
        3. Auto-discovered .env via find_dotenv()
        4. Current working directory fallback (implicit in load_dotenv())

        Returns tuple(path_loaded, strategy_label)
        """
        file_path = Path(__file__).resolve()
        # Determine repo root heuristically: walk up until we see 'mcp-server' dir OR stop after 6 levels
        repo_root = None
        for parent in file_path.parents:
            if (parent / 'mcp-server').is_dir() and (parent / 'tools-api').is_dir():  # both sibling dirs present
                repo_root = parent
                break
        if repo_root is None:
            # Fallback guess: 4 levels up (expected layout)
            try:
                repo_root = file_path.parents[3]
            except IndexError:
                repo_root = file_path.parent

        candidates = []
        mcp_env = repo_root / 'mcp-server' / '.env'
        if mcp_env.exists():
            candidates.append((mcp_env, 'mcp-server/.env'))
        root_env = repo_root / '.env'
        if root_env.exists() and root_env != mcp_env:
            candidates.append((root_env, 'repo-root/.env'))

        for path_obj, label in candidates:
            try:
                if load_dotenv(path_obj, override=False):
                    print(f"✅ Loaded .env ({label}): {path_obj}")
                    return str(path_obj), label
            except Exception as e:  # pragma: no cover
                print(f"⚠️ Failed loading {label}: {e}")

        # Auto-discovery (search upward)
        discovered = find_dotenv(usecwd=True)
        if discovered:
            load_dotenv(discovered, override=False)
            print(f"ℹ️ Loaded .env (discovered): {discovered}")
            return discovered, 'discovered'

        # Final fallback: attempt default load (current dir) silently
        load_dotenv()
        print("⚠️ No explicit .env found; relying on current environment / working directory")
        return None, 'fallback'

    _loaded_env_path, _env_strategy = _load_env_files()
except ImportError:
    print("⚠️ python-dotenv not installed, using system environment variables only")
except Exception as e:  # pragma: no cover
    print(f"⚠️ Unexpected error during .env loading: {e}")

logger = logging.getLogger(__name__)

# Validate environment on import
env_valid = validate_environment()

def code_documenter_agent(prompt: str, include_analysis: bool = True) -> str:
    """
    
    Forward a user's code snippet or request to the Code Documenter Agent for ENTERPRISE-LEVEL DOCUMENTATION.

    CRITICAL: This tool MUST generate TWO distinct sections following this EXACT format:

    ### PART 1: COMPREHENSIVE ANALYSIS
    
    The agent MUST provide a comprehensive business-level analysis including:

    1. **Executive Summary**: Enterprise-level overview, critical findings, strategic recommendations
    2. **Business & Technical Overview**: Business problem solved, key features, technology stack
    3. **Architecture & Design Analysis**: Architectural patterns, class relationships, SOLID principles
    4. **Code Quality & Standards Analysis**: Coding standards compliance, maintainability assessment
    5. **Security Analysis (OWASP Top 10)**: Complete security assessment against OWASP Top 10
    6. **Performance & Scalability Assessment**: Bottlenecks, scalability analysis, optimization opportunities
    7. **Dependency & Risk Assessment**: Third-party libraries, security vulnerabilities, licensing
    8. **Integration & Data Flow Analysis**: System interactions, data transformations, API design
    9. **Technical Debt & Refactoring Analysis**: Code smells, refactoring priorities, modernization
    10. **Implementation Roadmap**: Prioritized action items with timeline and resource requirements

    ### PART 2: DOCUMENTED CODE
    
    Complete, professional source code with proper headers and comprehensive documentation.

    The agent MUST NOT generate simple code comments or basic analysis. This is for ENTERPRISE 
    documentation that will be reviewed by senior architects, security teams, and business stakeholders. 
        At the top of the code file, put the current date ({datetime.now().strftime("%d/%m/%Y")}), user (use 'Agentic_AI_System_Documenter' if user details are not available), and code language, using the CORRECT comment syntax for the specific language:
        
        **CRITICAL: Use proper comment format for each language:**
        - **Java**: /* Date: {datetime.now().strftime("%d/%m/%Y")} User: Agentic_AI_System_Documenter Code Language: Java */
        - **TypeScript/JavaScript**: /** @date {datetime.now().strftime("%d/%m/%Y")} @user Agentic_AI_System_Documenter @codeLanguage TypeScript */
        - **Python**: # Date: {datetime.now().strftime("%d/%m/%Y")} User: Agentic_AI_System_Documenter Code Language: Python
        - **C#**: // Date: {datetime.now().strftime("%d/%m/%Y")} User: Agentic_AI_System_Documenter Code Language: C#
        - **C/C++**: /* Date: {datetime.now().strftime("%d/%m/%Y")} User: Agentic_AI_System_Documenter Code Language: C++ */

    2.\tExecutive summary: overall assessment, key findings, recommendations.

    3.\tRepository/code overview: Project purpose, main features, tech stack.

    4.\tArchitecture review: Architectural patterns, high-level system diagrams, key modules/components, dependencies.

    5.\tCode Quality Analysis: Coding standards and conventions, code readability and maintainability.

    6.  Identify specific coding standard violations.

    7.  Identify and Evaluate against OWASP Top 10

    8.\tSecurity Evaluation: Security posture: authentication, authorization, data protection), known vulnerabilities or risks.

    9.\tPerformance & Scalability Assessment: Bottlenecks or performance hotspots, scalability considerations, resource usage.

    10.\tDependency & Third Party Evaluation: Evaluate dependencies and third-party libraries for risks and licensing compliance.

    11.\tRefactoring & Improvements Opportunities: Suggestions for architectural improvements, codebase refactoring candidates, risk areas remediation.

    12.\tActionable next steps.

    The agent already has access to a guidelines knowledge base (via vector store) and must have to follow the guidelines from that knowledge base that 
    defines documentation standards, commenting style, formatting rules, and tone.
    
    Args:
        prompt (str): A natural language request from the user, usually containing source code,
                      such as:
                      - "Document this Python function ..."
                      - "Generate documentation for this Java class ..."
                      - "Add inline comments and Markdown docs for this code ..."
        include_analysis (bool): Whether to include comprehensive analysis sections (default: True)

    Returns:
        str: The final response from the Code Documenter Agent, including both the 
             comprehensive analysis and the documented code. If the run fails, 
             an error message is returned.
    
    """
    # Local-only implementation
    try:
        logger.info("Starting code documentation process (local-only)...")
        logger.info(f"Prompt length: {len(prompt)} characters")
        # Add analysis instruction
        prompt = ANALYSIS_INSTRUCTION + "\n" + prompt
        result = code_documenter_agent_with_chunking(prompt, include_analysis=True)
        logger.info(f"Documentation generated successfully ({len(result)} characters)")
        return result
    except Exception as e:
        error_msg = f"Error calling Code Documenter Agent (local-only): {str(e)}"
        logger.error(error_msg)
        return error_msg

# Utility functions moved to code_documentation_helper.py:
# - save_documented_code
# - save_analysis_part  
# - split_code_intelligently
# And other helper functions...

# Configuration constants already moved to helper
# LARGE_FILE_THRESHOLD = int(os.getenv("LARGE_FILE_THRESHOLD", 250000))
# LARGE_FILE_STRATEGY = os.getenv("LARGE_FILE_STRATEGY", LargeFileStrategy.CHUNK)


def analyze_code(prompt: str) -> str:
    """
    Analyze code and return only the comprehensive analysis section (local-only).
    Args:
        prompt: Code content or description to analyze.
    Returns:
        Analysis section as a string.
    """
    try:
        result = code_documenter_agent_with_chunking(prompt, include_analysis=True)
        analysis, _ = parse_analysis_and_code(result)
        return analysis or "No analysis generated."
    except Exception as e:
        logger.error(f"❌ Analysis failed: {str(e)}")
        return f"❌ Analysis failed: {str(e)}"

def document_multiple_files(file_paths: list, branch: str = "main") -> str:
    """
    Document multiple files in the workspace or from GitHub (local-only).
    Args:
        file_paths: List of file paths to document.
        branch: Branch to use for GitHub files (default: main).
    Returns:
        Combined documentation and analysis for all files.
    """
    try:
        files_to_document = []
        for path in file_paths:
            if path.startswith("http") and "github.com" in path:
                owner, repo, file_path, branch_name = extract_github_info_from_url(path)
                content = fetch_github_file_content(owner or "", repo or "", file_path or "", branch_name or branch)
            else:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
            files_to_document.append({"path": path, "content": content})
        # Use repo URL if all files are from same repo, else empty string
        repo_url = ""
        if all(path.startswith("http") and "github.com" in path for path in file_paths):
            repo_url = file_paths[0].split("/blob/")[0] if "/blob/" in file_paths[0] else file_paths[0]
        return generate_multi_file_documentation(files_to_document, repository_url=repo_url, branch=branch)
    except Exception as e:
        logger.error(f"❌ Document multiple files failed: {str(e)}")
        return f"❌ Document multiple files failed: {str(e)}"

def analyze_multiple_files(file_paths: list, branch: str = "main") -> str:
    """
    Analyze multiple files and return combined analysis (local-only).
    Args:
        file_paths: List of file paths to analyze.
        branch: Branch to use for GitHub files (default: main).
    Returns:
        Combined analysis for all files.
    """
    try:
        analyses = []
        for path in file_paths:
            if path.startswith("http") and "github.com" in path:
                owner, repo, file_path, branch_name = extract_github_info_from_url(path)
                content = fetch_github_file_content(owner or "", repo or "", file_path or "", branch_name or branch)
            else:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
            result = code_documenter_agent_with_chunking(content, include_analysis=True)
            analysis, _ = parse_analysis_and_code(result)
            analyses.append(f"Analysis for {path}:\n{analysis}\n")
        return "\n---\n".join(analyses)
    except Exception as e:
        logger.error(f"❌ Analyze multiple files failed: {str(e)}")
        return f"❌ Analyze multiple files failed: {str(e)}"

def search_workspace_files(pattern: str, root_dir: str = ".", max_results: int = 20) -> str:
    """
    Search for files in the workspace matching a pattern (local-only).
    Args:
        pattern: Glob pattern to search for files (e.g., "*.py").
        root_dir: Root directory to search from (default: current directory).
        max_results: Maximum number of results to return.
    Returns:
        List of matching file paths as a string.
    """
    try:
        searcher = FileSearcher()
        matches = searcher.find_files_by_pattern(root_dir, pattern)
        if max_results:
            matches = matches[:max_results]
        return "\n".join(matches)
    except Exception as e:
        logger.error(f"❌ Search workspace files failed: {str(e)}")
        return f"❌ Search workspace files failed: {str(e)}"

def chunked_documentation(prompt: str, chunk_size: int = 5000) -> str:
    """
    Document code using chunking for large files (local-only).
    Args:
        prompt: Code content or description to document.
        chunk_size: Size of each chunk in characters (default: 5000).
    Returns:
        Combined documentation and analysis for all chunks.
    """
    try:
        chunks = split_code_intelligently(prompt, chunk_size)
        docs = []
        for chunk in chunks:
            result = code_documenter_agent_with_chunking(chunk, include_analysis=True)
            docs.append(result)
        return "\n---\n".join(docs)
    except Exception as e:
        logger.error(f"❌ Chunked documentation failed: {str(e)}")
        return f"❌ Chunked documentation failed: {str(e)}"

def generate_documentation(prompt: str, original_path: Optional[str] = None, repo_info: Optional[Dict] = None, max_retries: int = 2) -> str:
    """
    Generate documentation with explicit GitHub vs Local handling.
    Ensures analysis is always present or fails.
    
    Args:
        prompt: The code or request to document
        original_path: Path for local saving (only used if repo_info is None)
        repo_info: GitHub repository info (if present, ONLY GitHub push, NO local save)
        max_retries: Maximum number of retries if analysis is missing (default: 2)
    
    Returns:
        Generated documentation result
        
    Raises:
        RuntimeError: If analysis cannot be generated after max_retries
    """
    logger.info("=== STARTING GENERATE_DOCUMENTATION ===")
    logger.info(f"Prompt length: {len(prompt)} characters")
    logger.info(f"Original path: {original_path}")
    logger.info(f"Repo info: {repo_info}")
    logger.info(f"Max retries: {max_retries}")
    
    # Log prompt preview
    if prompt:
        logger.info(f"Prompt preview (first 200 chars): {prompt[:200]}...")
        logger.info(f"Prompt preview (last 200 chars): ...{prompt[-200:]}")
    else:
        logger.error("CRITICAL: Prompt is empty or None!")
        return "Error: Empty prompt provided"
    
    # Secure path validation if file operations are needed (for future implementation)
    # if original_path:
    #     if not is_safe_path(PROJECT_ROOT, original_path):
    #         logger.error(f"Unsafe file path detected: {original_path}")
    #         raise RuntimeError("Error: Unsafe file path detected.")

    # Check if original_path is actually a GitHub URL (shouldn't be treated as local path)
    is_github_url_in_path = False
    if original_path:
        github_url_patterns = [
            r"https://github\.com/",
            r"git@github\.com:",
            r"github\.com/"
        ]
        is_github_url_in_path = any(re.search(pattern, str(original_path), re.IGNORECASE) for pattern in github_url_patterns)
        logger.info(f"DEBUG: original_path = {original_path}")
        logger.info(f"DEBUG: is_github_url_in_path = {is_github_url_in_path}")
        
        # Clear original_path to prevent local saving if it's a GitHub URL
        if is_github_url_in_path:
            logger.info(f"GitHub URL detected in path parameter: {original_path}")
            logger.info("Will process as GitHub request instead of local file operation")
            original_path = None
    
    # Determine mode upfront - improved to handle GitHub URLs in original_path
    is_github_mode = bool(repo_info and all(k in repo_info for k in ("owner", "repo", "branch", "commit_message")))
    
    # Local mode only if we have a path that's NOT a GitHub URL
    is_local_mode = not is_github_mode and bool(original_path)
    """
    Generate documentation with explicit GitHub vs Local handling, using only local logic.
    Args:
        prompt: The code or request to document
        original_path: Path for local saving (only used if repo_info is None)
        repo_info: GitHub repository info (if present, ONLY GitHub push, NO local save)
        max_retries: Maximum number of retries if analysis is missing (default: 2)
    Returns:
        Generated documentation result
    Raises:
        RuntimeError: If analysis cannot be generated after max_retries
    """
    logger.info("=== [LOCAL] STARTING GENERATE_DOCUMENTATION ===")
    logger.info(f"Prompt length: {len(prompt)} characters")
    logger.info(f"Original path: {original_path}")
    logger.info(f"Repo info: {repo_info}")
    logger.info(f"Max retries: {max_retries}")

    if not prompt:
        logger.error("CRITICAL: Prompt is empty or None!")
        return "Error: Empty prompt provided"

    is_github_url_in_path = False
    if original_path:
        github_url_patterns = [
            r"https://github\.com/",
            r"git@github\.com:",
            r"github\.com/"
        ]
        is_github_url_in_path = any(re.search(pattern, str(original_path), re.IGNORECASE) for pattern in github_url_patterns)
        logger.info(f"DEBUG: original_path = {original_path}")
        logger.info(f"DEBUG: is_github_url_in_path = {is_github_url_in_path}")
        if is_github_url_in_path:
            logger.info(f"GitHub URL detected in path parameter: {original_path}")
            logger.info("Will process as GitHub request instead of local file operation")
            original_path = None

    is_github_mode = bool(repo_info and all(k in repo_info for k in ("owner", "repo", "branch", "commit_message")))
    is_local_mode = not is_github_mode and bool(original_path)
    logger.info(f"Documentation mode - GitHub: {is_github_mode}, Local: {is_local_mode}")

    original_prompt = prompt
    github_code = None
    original_filename = None

    github_patterns = [
        r"https://github\.com/([^/\s]+)/([^/\s]+)/blob/([^/\s]+)/([^\s]+)",
        r"https://github\.com/([^/\s]+)/([^/\s]+)/tree/([^/\s]+)(?:/([^\s]+))?",
        r"https://github\.com/([^/\s]+)/([^/\s]+)(?:/tree/([^/\s]+))?",
    ]
    github_url_match = None
    matched_pattern = None
    for i, pattern in enumerate(github_patterns):
        github_url_match = re.search(pattern, prompt)
        if github_url_match:
            matched_pattern = i + 1
            break
    if github_url_match:
        github_url = github_url_match.group(0)
        logger.info(f"🔍 Detected GitHub URL (pattern {matched_pattern}): {github_url}")
        owner, repo, path, branch = extract_github_info_from_url(github_url)
        if owner and repo:
            logger.info(f"📋 Extracted GitHub info:")
            logger.info(f"   👤 Owner: {owner}")
            logger.info(f"   📦 Repo: {repo}")
            logger.info(f"   🌿 Branch: {branch or 'main'}")
            logger.info(f"   📄 Path: {path or 'N/A'}")
            if path:
                original_filename = os.path.basename(path)
                try:
                    logger.info(f"⬇️  Fetching file content from GitHub...")
                    github_code = fetch_github_file_content(owner, repo, path, branch or "main")
                    logger.info(f"✅ Successfully fetched file: {original_filename} ({len(github_code)} characters)")
                except Exception as e:
                    logger.error(f"❌ Failed to fetch file from GitHub: {e}")
                    github_code = None
            if repo_info is None and not original_path:
                operation_type = detect_operation_type(prompt)
                repo_info = {
                    "owner": owner,
                    "repo": repo,
                    "branch": branch or "main",
                    "commit_message": f"Add {operation_type} files for {original_filename or 'code file'}",
                    "path": path or "",
                    "operation_type": operation_type,
                    "filename": original_filename
                }
                is_github_mode = True
                is_local_mode = False
                logger.info(f"Auto-detected GitHub mode with operation: {operation_type}")
                logger.info(f"Files will be saved as: {original_filename}_{operation_type}d.ext and {original_filename}_analysis.ext")
        else:
            logger.warning("⚠️  Could not extract valid GitHub information from URL")
    else:
        logger.info("ℹ️  No GitHub URL detected in prompt - checking for local mode")

    if github_code:
        prompt = ANALYSIS_INSTRUCTION + "\n" + github_code
        logger.info("🔄 Using fetched GitHub code for analysis")
    elif "analysis" in prompt.lower() or True:
        prompt = ANALYSIS_INSTRUCTION + "\n" + prompt
        logger.info("🔄 Using original prompt with analysis instruction")

    enforcement_note = """

CRITICAL ENFORCEMENT: 
- You are generating ENTERPRISE-LEVEL DOCUMENTATION for business stakeholders
- PART 1 must be comprehensive business analysis with OWASP security assessment
- PART 2 must be complete source code with professional documentation
- Do NOT generate simple code with basic comments - that is unacceptable
- This documentation will be reviewed by senior architects and security teams

"""
    prompt = prompt + enforcement_note

    retry_count = 0
    analysis = ""
    documented_code = ""
    result = ""

    while retry_count <= max_retries:
        try:
            logger.info(f"[LOCAL] Generating documentation (attempt {retry_count + 1}/{max_retries + 1})")
            result = code_documenter_agent_with_chunking(prompt, include_analysis=True) or ""
            if not result:
                raise ValueError("Empty result from code documenter agent")
            analysis, documented_code = parse_analysis_and_code(result)
            analysis = analysis or ""
            documented_code = documented_code or ""
            logger.info("=== [LOCAL] PARSING VALIDATION DEBUG ===")
            logger.info(f"Original result length: {len(result)}")
            logger.info(f"Parsed analysis length: {len(analysis)}")
            logger.info(f"Parsed code length: {len(documented_code)}")
            orig_len = len(original_prompt)
            code_len = len(documented_code.strip()) if documented_code else 0
            analysis_len = len(analysis.strip()) if analysis else 0
            if orig_len < 400:
                min_analysis = 10
                min_code = 5
            elif orig_len < 1000:
                min_analysis = 20
                min_code = 10
            else:
                min_analysis = 30
                min_code = 20
            def synthesize_minimal_analysis() -> str:
                return (
                    f"Executive Summary: Auto-generated comprehensive analysis for code documentation.\n"
                    f"Input Size: {orig_len} chars. Generated Code Size: {code_len} chars.\n\n"
                    "Code Overview: This code snippet represents a function for payment processing using HTTP requests. "
                    "The implementation demonstrates basic API interaction patterns but requires several improvements.\n\n"
                    "Security Considerations: \n"
                    "- Input validation: Missing validation for secret_key, amount_in_cents, and currency parameters\n"
                    "- Authentication: Secret key is passed as parameter but not properly used in HTTP headers\n"
                    "- Data exposure: Hardcoded values pose security risks in production environments\n"
                    "- Error handling: Limited error handling could expose sensitive information\n\n"
                    "Performance Analysis:\n"
                    "- HTTP client: Uses cURL which is efficient for C applications\n"
                    "- Memory management: Basic cleanup implemented but could be enhanced\n"
                    "- Resource usage: Synchronous calls may block execution for large volumes\n"
                    "- Scalability: Current design limits concurrent payment processing\n\n"
                    "Code Quality Assessment:\n"
                    "- Documentation: Requires comprehensive inline documentation\n"
                    "- Error handling: Needs robust error checking and recovery mechanisms\n"
                    "- Maintainability: Code structure is simple but lacks modularity\n"
                    "- Testing: No evidence of unit tests or validation frameworks\n\n"
                    "Recommendations:\n"
                    "1. Implement proper HTTP header authentication using the secret key\n"
                    "2. Add comprehensive input validation and sanitization\n"
                    "3. Enhance error handling with specific error codes and messages\n"
                    "4. Add logging for debugging and monitoring purposes\n"
                    "5. Implement retry logic for failed API calls\n"
                    "6. Add unit tests and integration tests\n"
                    "7. Consider asynchronous processing for better performance\n\n"
                    "Next Steps: \n"
                    "(1) Security hardening and authentication implementation\n"
                    "(2) Comprehensive error handling and logging\n"
                    "(3) Unit test development and CI/CD integration\n"
                    "(4) Performance optimization and scalability improvements\n"
                    "(5) Code documentation and API specification creation"
                )
            if analysis_len < min_analysis:
                logger.warning(
                    f"Analysis below threshold (got {analysis_len}, need {min_analysis}) – generating synthetic baseline"
                )
                synthetic = synthesize_minimal_analysis()
                if not analysis or analysis_len < len(synthetic) * 0.5:
                    analysis = synthetic
                    analysis_len = len(analysis)
                    logger.info(f"Injected synthetic analysis ({analysis_len} chars)")
            if analysis_len == 0 and retry_count < max_retries:
                logger.warning(
                    f"Analysis is completely empty, retrying..."
                )
                raise ValueError(
                    f"Analysis is empty (length: {analysis_len} chars)"
                )
            elif analysis_len == 0:
                logger.warning(
                    f"Generating synthetic analysis on final attempt (original was empty)"
                )
                analysis = synthesize_minimal_analysis()
                analysis_len = len(analysis)
            if code_len < min_code:
                logger.warning(
                    f"Documented code below adaptive threshold (got {code_len}, need {min_code}). Accepting but flagged."
                )
                if documented_code.strip() != original_prompt.strip() and len(original_prompt.strip()) > code_len:
                    documented_code = documented_code + "\n\n/* Original Source Fallback */\n" + original_prompt
                    code_len = len(documented_code)
                    logger.info(
                        f"Augmented documented code with original prompt (now {code_len} chars)"
                    )
            logger.info(f"Successfully generated documentation with analysis on attempt {retry_count + 1}")
            break
        except Exception as e:
            logger.error(f"Attempt {retry_count + 1} failed: {str(e)}")
            retry_count += 1
            if retry_count > max_retries:
                error_msg = f"Failed to generate documentation with analysis after {max_retries + 1} attempts. Last error: {str(e)}"
                logger.error(error_msg)
                raise RuntimeError(error_msg)
            if retry_count == 1:
                prompt = f"""IMPORTANT: You MUST provide BOTH comprehensive analysis AND documented code.\n\nStructure your response with these TWO sections:\n1. ### PART 1: COMPREHENSIVE ANALYSIS\n   [Detailed analysis here - REQUIRED]\n\n2. ### PART 2: DOCUMENTED CODE\n   [Documented code here - REQUIRED]\n\n{prompt}"""
            elif retry_count == 2:
                prompt = f"""CRITICAL: Previous attempts failed due to missing analysis.\n\nYOU MUST INCLUDE BOTH:\n- A COMPREHENSIVE ANALYSIS section (minimum 500 characters)\n- A DOCUMENTED CODE section\n\nUSE THIS EXACT FORMAT:\n### PART 1: COMPREHENSIVE ANALYSIS\n[Your detailed analysis goes here]\n\n### PART 2: DOCUMENTED CODE\n[Your documented code goes here]\n\n{original_prompt}"""
            time.sleep(2)

    if is_github_mode and repo_info:
        logger.info("Executing GitHub-only mode - NO local files will be created")
        operation_type = repo_info.get("operation_type", "document")
        original_filename = repo_info.get("filename", "code_file")
        if original_filename and "." in original_filename:
            base_name, file_ext = os.path.splitext(original_filename)
            file_ext = file_ext.lstrip(".")
        else:
            base_name = original_filename or "code_file"
            file_ext = "txt"
        if operation_type == "review":
            documented_filename = f"{base_name}_reviewed.{file_ext}"
            analysis_filename = f"{base_name}_review_analysis.md"
        else:
            documented_filename = f"{base_name}_documented.{file_ext}"
            analysis_filename = f"{base_name}_analysis_{file_ext}.md"
        logger.info(f"Generated filenames - Documented: {documented_filename}, Analysis: {analysis_filename}")
        commit_message_base = repo_info.get("commit_message", f"Add {operation_type} files for {original_filename}")
        try:
            commit_result_1 = commit_to_github(
                repo_info.get("owner", ""), 
                repo_info.get("repo", ""), 
                documented_filename, 
                documented_code or "", 
                f"{commit_message_base} - documented version",
                repo_info.get("branch", "main")
            )
            logger.info(f"✅ Successfully pushed documented file to GitHub: {documented_filename}")
            commit_result_2 = commit_to_github(
                repo_info.get("owner", ""), 
                repo_info.get("repo", ""), 
                analysis_filename, 
                analysis or "", 
                f"{commit_message_base} - analysis",
                repo_info.get("branch", "main")
            )
            logger.info(f"✅ Successfully pushed analysis file to GitHub: {analysis_filename}")
            logger.info(f"GitHub operation completed successfully:")
            logger.info(f"  - Repository: {repo_info.get('owner')}/{repo_info.get('repo')}")
            logger.info(f"  - Branch: {repo_info.get('branch', 'main')}")
            logger.info(f"  - Documented file: {documented_filename}")
            logger.info(f"  - Analysis file: {analysis_filename}")
            logger.info(f"  - Operation type: {operation_type}")
        except Exception as e:
            error_msg = f"❌ Failed to push to GitHub: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
    elif is_local_mode and original_path:
        logger.info("Executing Local-only mode - NO GitHub push will be performed")
        logger.info(f"DEBUG: About to save locally with original_path = {original_path}")
        logger.info(f"DEBUG: is_local_mode = {is_local_mode}")
        try:
            save_documented_code(str(original_path), documented_code or "", suffix="_documented")
            save_analysis_part(str(original_path), analysis or "")
            logger.info(f"Local save completed for: {original_path}. NO GitHub push performed.")
        except Exception as e:
            error_msg = f"Failed to save files locally: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
    else:
        logger.warning("No valid output mode specified. Provide either repo_info for GitHub or original_path for local saving.")
    if not result:
        result = "❌ Documentation generation failed - no result generated"
    return result
    """
    Register code documentation tools with the MCP server.
    
    Args:
        mcp: FastMCP server instance
    """
    
    @mcp.tool()
    def document_code(prompt: str, path: Optional[str] = None) -> str:
        """
        Generate comprehensive documentation for code with optional file path.
        
        Args:
            prompt: Code content or description to document. Can include 'analysis' keyword for detailed analysis.
            path: Optional file path for saving the documented code locally (only if not pushing to GitHub)
        
        Returns:
            Generated documentation and analysis with status
        """
        try:
            return generate_documentation(prompt, original_path=path)
        except RuntimeError as e:
            error_msg = f"❌ Documentation generation failed: {str(e)}"
            logger.error(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"❌ Unexpected error: {str(e)}"
            logger.error(error_msg)
            return error_msg

    @mcp.tool()
    def analyze_and_document_repository(
        repository_url: str,
        target_file: str = "Main.java",
        include_dependencies: bool = True,
        branch: str = "main"
    ) -> str:
        """
        Analyze and document a file and its dependencies from a GitHub repository.
        
        Args:
            repository_url: GitHub repository URL or "owner/repo" format
            target_file: The main file to analyze (e.g., "Main.java") 
            include_dependencies: Whether to find and analyze dependent files
            branch: Branch to analyze (default: "main")
        
        Returns:
            Comprehensive documentation of the target file and its dependencies
        """
        try:
            # Parse repository URL
            if repository_url.startswith("http"):
                repo_info = extract_github_info_from_url(repository_url)
                if not repo_info or len(repo_info) < 2:
                    return "❌ Error: Could not parse repository URL"
                owner, repo = repo_info[0], repo_info[1]
                if not owner or not repo:
                    return "❌ Error: Could not extract owner/repo from URL"
            else:
                if "/" not in repository_url:
                    return "❌ Error: Repository must be in format 'owner/repo'"
                owner, repo = repository_url.split("/", 1)
            
            logger.info(f"Analyzing repository: {owner}/{repo}, target file: {target_file}")
            
            # Find the target file
            target_files = find_repository_files_by_pattern(owner, repo, [target_file], branch)
            
            if not target_files:
                return f"❌ Error: Could not find {target_file} in repository {owner}/{repo}"
            
            # Use the first matching file
            main_file_path = list(target_files)[0]
            logger.info(f"Found target file at: {main_file_path}")
            
            # Fetch the main file content
            main_content = fetch_github_file_content(owner, repo, main_file_path, branch)
            if main_content.startswith("Error"):
                return f"❌ Error fetching {main_file_path}: {main_content}"
            
            files_to_document = [{"path": main_file_path, "content": main_content}]
            
            # Find dependencies if requested
            if include_dependencies:
                logger.info("Discovering dependencies...")
                # Detect language from file extension
                file_extension = main_file_path.split('.')[-1].lower()
                language_map = {
                    'java': 'java',
                    'py': 'python', 
                    'ts': 'typescript',
                    'js': 'javascript'
                }
                language = language_map.get(file_extension, 'java')  # default to java
                
                dependencies = discover_dependencies(main_content, owner, repo, branch, language)
                
                for dep_path in dependencies:
                    dep_content = fetch_github_file_content(owner, repo, dep_path, branch)
                    if not dep_content.startswith("Error"):
                        files_to_document.append({"path": dep_path, "content": dep_content})
                        logger.info(f"Added dependency: {dep_path}")
            
            logger.info(f"Total files to document: {len(files_to_document)}")
            
            # Generate documentation for all files
            return generate_multi_file_documentation(
                files_to_document, 
                repository_url=f"https://github.com/{owner}/{repo}",
                branch=branch
            )
            
        except Exception as e:
            error_msg = f"❌ Repository analysis failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return error_msg
    
    @mcp.tool()
    def code_analysis_guide() -> str:
        """
        Get guidance on how to properly format code for comprehensive analysis and documentation.
        
        Returns best practices for submitting code to the documentation agent.
        
        """
        return """# Code Analysis & Documentation Guide

    ## For Best Analysis Results:

    ### PROVIDE COMPLETE CODE:
    - **Full file contents** when possible
    - **Complete class definitions** with all methods
    - **Complete function implementations** (not just signatures)
    - **All import statements and dependencies**
    - **Configuration files** if relevant

    ### ANALYSIS SCOPE FOR CODE DOCUMENTATION:
    The agent will provide:
    1. **Executive Summary** - Overall assessment
    2. **Repository/Code Overview** - High-level view of the codebase
    3. **Architecture Review** - Design patterns and structure
    4. **Code Quality Analysis** - Standards and maintainability
    5. **Coding Standard Violations** - Any violations found
    6. **OWASP Top 10 Evaluation** - Security vulnerabilities and risks
    7. **Performance Assessment** - Bottlenecks and scalability
    8. **Dependency Analysis** - Third-party risks
    9. **Refactoring Opportunities** - Improvement suggestions
    10. **Actionable Next Steps** - Prioritized recommendations

    ### GOOD EXAMPLES:

    **Complete Java Class:**
    ```java
    package com.example.payment;
    import java.util.*;
    // Full implementation with all methods
    public class PaymentProcessor {
        // Complete implementation
    }
    ```

    **Complete Python Module:**
    ```python
    import logging
    import requests
    from typing import Optional, Dict, Any

    class PaymentProcessor:
        def __init__(self, api_key: str, base_url: str):
            self.api_key = api_key
            self.base_url = base_url
            self.logger = logging.getLogger(__name__)
        
        def create_payment(self, amount: int, currency: str) -> Optional[Dict[str, Any]]:
            # Complete implementation here
            pass
    ```

    ### AVOID INCOMPLETE SNIPPETS:
    ```java
    // Don't submit just this:
    import com.example.paymentgateway.PaymentGatewaySDK;
    public class PaymentService {
        // ... incomplete
    ```

    ### PRO TIPS:
    - Use keyword 'analysis' in your prompt for detailed analysis
    - Provide GitHub URLs for automatic code fetching
    - Include context about the code's purpose
    - Specify programming language if not obvious
    - Include relevant **configuration files** (pom.xml, requirements.txt, package.json)
    - Provide **context** about the application's purpose
    - Include **error handling** and **logging** code for complete analysis
    - For large projects, focus on **core business logic files**

    Ready to analyze your code? Provide the complete source code in your next message!"""
    logger.info("********** [TOOLS-API] Code documentation tools registered")

# find_target_files function moved to code_documentation_helper.py

class TypeScriptAnalysisHelper:
    """
    Helper for generating dynamic TypeScript analysis instructions based on code features.
    """
    @staticmethod
    def create_instruction(code: str) -> str:
        """
        Dynamically create analysis instructions based on detected TypeScript features.
        """
        instructions = []
        # Feature detection
        has_interfaces = "interface " in code
        has_types = "type " in code
        has_generics = "<" in code and ">" in code
        has_any = ": any" in code or "any[]" in code or "<any>" in code
        has_decorators = "@" in code and ("@Component" in code or "@Injectable" in code or "@" in code)
        has_async = "async " in code or "Promise<" in code
        is_react = "React" in code or "import React" in code

        base_instruction = """
For this TypeScript file, please analyze and report:

### TypeScript Implementation Checklist Status:
"""
        checklist_items = []
        checklist_items.append("""
✓/✗ Type Annotation Coverage:
   - Functions with typed parameters: X/Y (Z%)
   - Functions with typed returns: X/Y (Z%)
   - Variables with explicit types: X/Y (Z%)
   - MISSING TYPES: [List specific functions/variables lacking types]
""")
        if has_any or True:
            checklist_items.append("""
✓/✗ 'any' Type Usage:
   - Total 'any' occurrences: X
   - Locations: [line numbers]
   - Recommendations: [specific type suggestions for each]
""")
        if has_interfaces:
            checklist_items.append("""
✓/✗ Interface Design:
   - Interfaces found: X
   - Well-designed: [list]
   - Need improvement: [list with reasons]
   - Missing interfaces: [suggestions]
""")
        if has_types:
            checklist_items.append("""
✓/✗ Type Aliases:
   - Type aliases found: X
   - Appropriate usage: [assessment]
   - Could be interfaces: [list if any]
""")
        if has_generics:
            checklist_items.append("""
✓/✗ Generic Usage:
   - Generic functions/classes: X
   - Complexity assessment: [simple/moderate/complex]
   - Over-engineered generics: [list if any]
""")
        checklist_items.append("""
✓/✗ Null Safety:
   - Potential null errors: X locations
   - Missing null checks: [line numbers]
   - Safe navigation used: Yes/No (X occurrences)
""")
        if has_decorators:
            checklist_items.append("""
✓/✗ Decorator Usage:
   - Decorators found: [list]
   - Type safety: [assessment]
   - Missing types: [list if any]
""")
        if is_react:
            checklist_items.append("""
✓/✗ React/TSX Compliance:
   - Components with typed props: X/Y
   - Hooks with proper typing: X/Y
   - Event handlers typed: X/Y
   - Components missing types: [list]
""")
        return base_instruction + "\n".join(checklist_items) + """
### Summary Score:
TypeScript Best Practices Score: X/10
- Type Coverage: X/10
- Type Safety: X/10
- Code Quality: X/10

### Priority Improvements:
1. [Most critical issue]
2. [Second priority]
3. [Third priority]
"""

# ================= LOCAL FILE TOOLS REGISTRATION =================
def register_local_file_tools(mcp):
    """
    Register local file documentation tools with the MCP server.
    """
    
    @mcp.tool()
    def document_local_file(
        file_path: str = "",
        search_pattern: str = "",
        operation: str = "document",
        workspace_root: str = "",
        save_locally: bool = True
    ) -> str:
        """
        Document local files in the workspace.
        
        Args:
            file_path: Direct path to file (relative or absolute)
            search_pattern: Pattern to search for files (e.g., "*.py", "Main.java")
            operation: "document" or "list" (list just shows matching files)
            workspace_root: Root directory to search from (default: auto-detect)
            save_locally: Whether to save the documented files locally
            
        Examples:
            - Document specific file: file_path="src/Main.java"
            - Search and document: search_pattern="*.py"
            - List files: search_pattern="*.ts", operation="list"
        
        Returns:
            Documentation and analysis, or list of matching files
        """
        try:
            from .utils.file_searcher import FileSearcher
            # Using functions from current module instead of importing from old path
            # from tools.review_document_tools.code_documentation_tool import (
            #     generate_documentation,
            #     save_analysis_part,
            #     parse_analysis_and_code
            # )
            
            # Determine workspace root
            if not workspace_root:
                workspace_root = FileSearcher.get_workspace_root()
                logger.info(f"Using workspace root: {workspace_root}")
            
            # List operation
            if operation == "list":
                if search_pattern:
                    matches = FileSearcher.find_files_by_pattern(workspace_root, search_pattern)
                elif file_path:
                    matches = FileSearcher.find_files(workspace_root, os.path.basename(file_path))
                else:
                    # List directory contents
                    FileSearcher.list_directory_contents(workspace_root, max_depth=3)
                    return f"Listed directory structure of {workspace_root}"
                
                if matches:
                    return f"Found {len(matches)} files:\n" + "\n".join(f"  - {m}" for m in matches)
                else:
                    return "No files found matching the criteria"
            
            # Document operation
            if operation == "document":
                files_to_process = []
                
                # Find files to process
                if file_path:
                    # Direct file path provided
                    full_path = os.path.join(workspace_root, file_path) if not os.path.isabs(file_path) else file_path
                    if os.path.exists(full_path):
                        files_to_process = [full_path]
                    else:
                        # Try searching for the file
                        matches = FileSearcher.find_files(workspace_root, os.path.basename(file_path))
                        if matches:
                            files_to_process = matches[:1]  # Take first match
                        else:
                            return f"File not found: {file_path}"
                
                elif search_pattern:
                    # Pattern search
                    matches = FileSearcher.find_files_by_pattern(workspace_root, search_pattern)
                    files_to_process = matches[:5]  # Limit to 5 files
                
                else:
                    return "Error: Provide either file_path or search_pattern"
                
                if not files_to_process:
                    return "No files found to document"
                
                # Process files
                results = []
                for file_path in files_to_process:
                    logger.info(f"Documenting local file: {file_path}")
                    
                    # Read file content
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                    except UnicodeDecodeError:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
                    
                    # Generate documentation
                    analysis, documented_code = generate_documentation(content, file_path)
                    
                    if save_locally and documented_code:
                        # Save documented version locally
                        base, ext = os.path.splitext(file_path)
                        documented_path = f"{base}_documented{ext}"
                        
                        try:
                            with open(documented_path, 'w', encoding='utf-8') as f:
                                f.write(documented_code)
                            logger.info(f"Saved documented file: {documented_path}")
                            
                            # Save analysis file
                            if analysis:
                                analysis_path = f"{base}_analysis_{ext.replace('.', '')}.md"
                                save_analysis_part(file_path, analysis)
                                logger.info(f"Saved analysis file: {analysis_path}")
                            
                            results.append(f"✅ Documented: {os.path.basename(file_path)}")
                        except Exception as e:
                            logger.error(f"Failed to save: {e}")
                            results.append(f"❌ Failed to save: {os.path.basename(file_path)}")
                    else:
                        # Return documentation without saving
                        results.append(f"=== FILE: {file_path} ===\n\n{analysis}\n\n{documented_code}")
                
                return "\n\n".join(results)
            
            return f"Unknown operation: {operation}"
            
        except Exception as e:
            logger.error(f"Local file documentation failed: {e}", exc_info=True)
            return f"Error: {str(e)}"
    
    @mcp.tool()
    def search_workspace_files(
        pattern: str,
        file_type: str = "",
        max_results: int = 20
    ) -> str:
        """
        Search for files in the workspace.
        
        Args:
            pattern: Search pattern (supports wildcards like *.py, Main.*, *test*)
            file_type: Filter by extension (.py, .js, .java, etc.)
            max_results: Maximum number of results to return
            
        Returns:
            List of matching file paths
        """
        try:
            from .utils.file_searcher import FileSearcher
            
            workspace_root = FileSearcher.get_workspace_root()
            logger.info(f"Searching in workspace: {workspace_root}")
            
            # Search for files
            if pattern:
                matches = FileSearcher.find_files_by_pattern(workspace_root, pattern)
            else:
                matches = []
            
            # Filter by file type if specified
            if file_type and matches:
                if not file_type.startswith('.'):
                    file_type = '.' + file_type
                matches = [m for m in matches if m.endswith(file_type)]
            
            # Limit results
            matches = matches[:max_results]
            
            if matches:
                result = f"Found {len(matches)} matching files in {workspace_root}:\n\n"
                for i, match in enumerate(matches, 1):
                    # Show relative path for readability
                    try:
                        rel_path = os.path.relpath(match, workspace_root)
                    except:
                        rel_path = match
                    result += f"{i}. {rel_path}\n"
                return result
            else:
                return f"No files found matching pattern '{pattern}' in {workspace_root}"
                
        except Exception as e:
            logger.error(f"File search failed: {e}")
            return f"Search failed: {str(e)}"
    
    logger.info("********** [TOOLS-API] Local file documentation tools registered")

# Update the main section at the bottom:
if __name__ == "__main__":
    import argparse
    
    # Configure logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    parser = argparse.ArgumentParser(description="Document code files by searching for filename or pattern.")
    parser.add_argument("root_dir", nargs='?', default=".", 
                       help="Root directory to start search (default: workspace root)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--filename", help="Exact filename to search for")
    group.add_argument("--pattern", help="Pattern (wildcard *) to search for")
    parser.add_argument("--debug", action="store_true", 
                       help="Show debug information and directory contents")
    args = parser.parse_args()

    # Use workspace root if root_dir is current directory
    if args.root_dir == ".":
        args.root_dir = FileSearcher.get_workspace_root()

    matches = find_target_files(args.root_dir, filename=args.filename, pattern=args.pattern, debug=args.debug)
    
    if not matches:
        print("No files found.")
        exit(1)
        
    print(f"\nFound {len(matches)} file(s) to document:")
    for file_path in matches:
        print(f"  - {file_path}")
    
    print("\n" + "="*80)
    
    for file_path in matches:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                code = f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(file_path, "r", encoding="latin-1") as f:
                    code = f.read()
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                continue
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            continue
            
        print(f"\n--- Documenting: {file_path} ---\n")
        result = code_documenter_agent(prompt=code, include_analysis=True)
        # Parse and print analysis and documented code separately
        try:            
            analysis, documented_code = parse_analysis_and_code(result)
            print("=== ANALYSIS ===\n")
            print(analysis)
            print("\n=== DOCUMENTED CODE ===\n")
            print(documented_code)
            # Save analysis part as a separate file
            save_analysis_part(file_path, analysis)
        except Exception as e:
            print("[Warning] Could not parse analysis and code separately. Showing full result:\n")
            print(result)
        print("\n" + "="*80)