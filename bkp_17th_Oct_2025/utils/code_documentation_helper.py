"""
Code Documentation Helper Module

This module contains utility functions and classes for code documentation operations.
Extracted from code_documentation_tool.py for better code organization.

Version: 1.0.0
Date: 12/Sep/2025
Author: Refactored for better modularity
"""

import os
import re
import logging
from typing import Set, List, Dict, Any, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

def validate_environment():
    """Validate that critical environment variables are loaded"""
    required_vars = [
        "CODE_DOCUMENTER_AGENT_ID",
        "PROJECT_ENDPOINT_STRING",
        "AZURE_SUBSCRIPTION_ID",
        "AZURE_RESOURCE_GROUP_NAME", 
        "AZURE_PROJECT_NAME"
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        else:
            # Show first few characters for verification (security conscious)
            preview = value[:10] + "..." if len(value) > 10 else value
            print(f"✅ {var}: {preview}")
    
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        return False
    
    print("✅ All required environment variables are loaded")
    return True

# Configuration constants
class LargeFileStrategy:
    """Strategies for handling large files during documentation"""
    CHUNK = "chunk"           # Split and process in chunks
    SUMMARIZE = "summarize"   # Create summary for analysis
    TRUNCATE = "truncate"     # Simple truncation
    REJECT = "reject"         # Reject large files

# Configuration loaded from environment (.env)
LARGE_FILE_THRESHOLD = int(os.getenv("LARGE_FILE_THRESHOLD", "250000"))
LARGE_FILE_STRATEGY = os.getenv("LARGE_FILE_STRATEGY", LargeFileStrategy.CHUNK)

# Analysis instruction templates
ANALYSIS_INSTRUCTION = """
CRITICAL INSTRUCTION: You MUST follow this exact format. Do NOT generate simple code comments. Generate comprehensive business analysis.

MANDATORY RESPONSE FORMAT:

### PART 1: COMPREHENSIVE ANALYSIS

#### 1. Executive Summary
Provide an executive-level overview of:
- Overall code quality assessment and business purpose
- Key architectural decisions and their impact
- Critical findings that require management attention
- Strategic recommendations for code evolution

#### 2. Business & Technical Overview  
Analyze the business context:
- What business problem does this code solve?
- Key features and capabilities provided
- Technology stack and framework choices
- Integration points with other systems

#### 3. Architecture & Design Analysis
Evaluate the system design:
- Architectural patterns used (MVC, Repository, Factory, etc.)
- Class relationships and inheritance hierarchies
- Dependency management and coupling analysis
- Design principle adherence (SOLID, DRY, KISS)

#### 4. Code Quality & Standards Analysis
Assess code quality metrics:
- Coding standards compliance (naming conventions, formatting)
- Code readability and maintainability score
- Documentation coverage and quality
- Code complexity analysis (cyclomatic complexity)
- Specific violations with line numbers

#### 5. Security Analysis (OWASP Top 10 Assessment)
Evaluate security posture against OWASP Top 10:
- **A01 Broken Access Control**: [Assessment with specific findings]
- **A02 Cryptographic Failures**: [Data protection analysis]  
- **A03 Injection**: [Input validation and SQL injection risks]
- **A04 Insecure Design**: [Security design flaws]
- **A05 Security Misconfiguration**: [Configuration security]
- **A06 Vulnerable Components**: [Third-party library risks]
- **A07 Authentication Failures**: [Auth implementation analysis]
- **A08 Software/Data Integrity**: [Data integrity measures]
- **A09 Logging/Monitoring**: [Audit trail analysis]
- **A10 Server-Side Request Forgery**: [SSRF vulnerability assessment]

#### 6. Performance & Scalability Assessment
Analyze performance characteristics:
- Performance bottlenecks and hotspots identified
- Memory usage patterns and potential leaks
- Database query optimization opportunities
- Scalability limitations and solutions
- Caching strategy evaluation

#### 7. Dependency & Risk Assessment
Evaluate external dependencies:
- Third-party libraries and their versions
- Security vulnerabilities in dependencies
- Licensing compliance issues
- Update and maintenance risks
- Alternative library recommendations

#### 8. Integration & Data Flow Analysis
Map system interactions:
- External system integration patterns
- Data transformation and validation flows
- API design and documentation quality
- Error handling and recovery mechanisms
- Transaction management analysis

#### 9. Technical Debt & Refactoring Analysis
Identify improvement opportunities:
- Code smells and anti-patterns detected
- Refactoring priorities with impact assessment
- Architecture evolution recommendations
- Legacy code modernization opportunities
- Test coverage gaps and testing strategy

#### 10. Implementation Roadmap
Provide actionable next steps:
- **High Priority (Immediate)**: Critical security/performance issues
- **Medium Priority (Next Quarter)**: Code quality improvements
- **Low Priority (Long-term)**: Architecture enhancements
- **Resource Requirements**: Team skills and time estimates
- **Risk Mitigation**: Strategies for safe implementation

### PART 2: DOCUMENTED CODE

Provide the complete, enhanced source code with:
- Proper language-specific header comment with current date
- Comprehensive JavaDoc/JSDoc comments for all classes and methods
- Inline comments explaining business logic and complex operations
- Enhanced variable names and method signatures
- Complete file structure (imports, class declaration, all methods)
- Professional-grade documentation suitable for enterprise environments

REMEMBER: 
- PART 1 must be comprehensive business analysis, NOT simple code comments
- PART 2 must be complete, properly formatted source code
- Use current date in DD/MM/YYYY format
- This is for enterprise-level documentation, not basic tutorials

## Code to Analyze:
"""

# TypeScript-specific analysis addition
TYPESCRIPT_ANALYSIS_INSTRUCTION = """
For TypeScript files, additionally analyze:

### TypeScript-Specific Analysis:

1. **Type System Usage**:
   - Type annotations coverage (percentage of typed vs untyped variables/functions)
   - Interface and type alias definitions
   - Use of `any`, `unknown`, `never` types
   - Type assertion usage and potential risks

2. **Advanced TypeScript Features**:
   - Generics usage and complexity
   - Decorators (if used)
   - Enums and const enums
   - Namespace/module organization
   - Type guards and type predicates
   - Union and intersection types
   - Mapped types and conditional types

3. **Type Safety Assessment**:
   - Strict mode compliance (`strict: true` in tsconfig)
   - Null safety (`strictNullChecks`)
   - Implicit any usage
   - Type casting safety
   - Runtime type checking needs

4. **Module System**:
   - Import/export patterns
   - Circular dependency detection
   - Module resolution strategy
   - Barrel exports usage

5. **React/JSX Support** (if applicable):
   - Component prop typing
   - Hook typing
   - Event handler typing
   - Context API typing

6. **Async Pattern Analysis**:
   - Promise typing
   - Async/await usage
   - Error handling in async code
   - Race condition risks

7. **Configuration Analysis**:
   - tsconfig.json settings review
   - Compiler options assessment
   - Build optimization opportunities
   
8. **Type Safety Vulnerabilities**:
   - Unsafe type assertions (`as` keyword abuse)
   - Bypassing type system with `any`
   - Missing runtime validation for external data

9. **Dependency Security**:
   - @types packages versions and vulnerabilities
   - Third-party type definition accuracy

10. **Configuration Security**:
   - tsconfig.json security-related settings
   - Source map exposure in production
   - Declaration file (.d.ts) information leakage

11. **React-Specific** (for .tsx files):
   - XSS prevention in JSX
   - Proper typing of user input handlers
   - Safe HTML rendering patterns   
"""

CHUNK_INSTRUCTION = """
Please document the following code chunk with proper comments and formatting:

IMPORTANT: Structure your response in TWO clear sections:
1. First section: Start with "### PART 1: CHUNK ANALYSIS" followed by brief analysis
2. Second section: Start with "### PART 2: DOCUMENTED CODE" followed by the documented code

## Code to Analyze:
"""

def discover_dependencies(source_code: str, owner: str, repo: str, branch: str = "main", language: str = "java") -> Set[str]:
    """
    Discover dependencies by parsing import/include statements and finding corresponding files in the repository.
    
    Args:
        source_code: The source code to analyze
        owner: GitHub repository owner
        repo: GitHub repository name
        branch: Branch to search in (default: "main")
        language: Programming language (java, python, typescript, etc.)
    
    Returns:
        Set of file paths that are dependencies of the given source code
    """
    dependencies = set()
    
    if language.lower() == "java":
        dependencies = _discover_java_dependencies(source_code, owner, repo, branch)
    elif language.lower() == "python":
        dependencies = _discover_python_dependencies(source_code, owner, repo, branch)
    elif language.lower() in ["typescript", "javascript", "ts", "js"]:
        dependencies = _discover_typescript_dependencies(source_code, owner, repo, branch)
    else:
        logger.warning(f"Dependency discovery not implemented for language: {language}")
    
    logger.info(f"Discovered {len(dependencies)} dependencies for {language}")
    return dependencies

def _discover_java_dependencies(java_code: str, owner: str, repo: str, branch: str = "main") -> Set[str]:
    """
    Discover Java dependencies by parsing import statements and finding corresponding files in the repository.
    
    Args:
        java_code: The Java source code to analyze
        owner: GitHub repository owner
        repo: GitHub repository name
        branch: Branch to search in (default: "main")
    
    Returns:
        Set of file paths that are dependencies of the given Java code
    """
    import github_tools
    
    dependencies = set()
    
    # Extract package name from the current file
    package_pattern = r'^\s*package\s+([\w\.]+)\s*;'
    package_match = re.search(package_pattern, java_code, re.MULTILINE)
    current_package = package_match.group(1) if package_match else ""
    
    # Extract import statements
    import_pattern = r'^\s*import\s+(static\s+)?([\w\.]+)(\.\*)?;'
    imports = re.findall(import_pattern, java_code, re.MULTILINE)
    
    logger.info(f"Found {len(imports)} import statements in Java code")
    
    for is_static, import_path, is_wildcard in imports:
        # Skip standard Java library imports
        if (import_path.startswith('java.') or 
            import_path.startswith('javax.') or
            import_path.startswith('org.junit')):
            continue
            
        # Convert package name to potential file path
        if is_wildcard:
            # For wildcard imports, we need to find all files in that package
            package_path = import_path.replace('.', '/')
            # Try to find files in this package directory
            potential_paths = [
                f"{package_path}/*.java",
                f"src/main/java/{package_path}/*.java",
                f"src/{package_path}/*.java"
            ]
        else:
            # For specific class imports
            class_name = import_path.split('.')[-1]
            package_path = '/'.join(import_path.split('.')[:-1])
            
            potential_paths = [
                f"{package_path}/{class_name}.java",
                f"src/main/java/{package_path}/{class_name}.java", 
                f"src/{package_path}/{class_name}.java",
                f"{import_path.replace('.', '/')}.java"
            ]
        
        # Try to fetch each potential path
        for path in potential_paths:
            try:
                content = github_tools.fetch_github_file_content(owner, repo, path, branch)
                if not content.startswith("Error"):
                    dependencies.add(path)
                    logger.info(f"Found dependency: {path}")
                    break
            except Exception as e:
                logger.debug(f"Could not fetch {path}: {e}")
                continue
    
    # Also look for files in the same package
    if current_package:
        package_path = current_package.replace('.', '/')
        same_package_paths = [
            f"{package_path}/",
            f"src/main/java/{package_path}/",
            f"src/{package_path}/"
        ]
        
        # This would require a GitHub API call to list directory contents
        # For now, we'll rely on explicit imports
    
    logger.info(f"Discovered {len(dependencies)} dependencies")
    return dependencies

def _discover_python_dependencies(python_code: str, owner: str, repo: str, branch: str = "main") -> Set[str]:
    """
    Discover Python dependencies by parsing import statements.
    """
    import github_tools
    
    dependencies = set()
    
    # Extract import statements
    import_patterns = [
        r'^\s*import\s+([\w\.]+)',
        r'^\s*from\s+([\w\.]+)\s+import'
    ]
    
    for pattern in import_patterns:
        imports = re.findall(pattern, python_code, re.MULTILINE)
        for import_path in imports:
            # Skip standard library imports
            if import_path in ['os', 'sys', 'json', 'datetime', 'logging', 're', 'typing']:
                continue
                
            # Convert module name to potential file path
            potential_paths = [
                f"{import_path.replace('.', '/')}.py",
                f"src/{import_path.replace('.', '/')}.py",
                f"{import_path.replace('.', '/')}/__init__.py"
            ]
            
            for path in potential_paths:
                try:
                    content = github_tools.fetch_github_file_content(owner, repo, path, branch)
                    if not content.startswith("Error"):
                        dependencies.add(path)
                        logger.info(f"Found Python dependency: {path}")
                        break
                except Exception as e:
                    logger.debug(f"Could not fetch {path}: {e}")
                    continue
    
    return dependencies

def _discover_typescript_dependencies(ts_code: str, owner: str, repo: str, branch: str = "main") -> Set[str]:
    """
    Discover TypeScript/JavaScript dependencies by parsing import statements.
    """
    import github_tools
    
    dependencies = set()
    
    # Extract import statements
    import_patterns = [
        r'^\s*import.*from\s+[\'"]([^\'"]+)[\'"]',
        r'^\s*import\s+[\'"]([^\'"]+)[\'"]'
    ]
    
    for pattern in import_patterns:
        imports = re.findall(pattern, ts_code, re.MULTILINE)
        for import_path in imports:
            # Skip node_modules imports
            if not import_path.startswith('.'):
                continue
                
            # Convert relative path to potential file path
            potential_paths = [
                f"{import_path}.ts",
                f"{import_path}.js",
                f"{import_path}/index.ts",
                f"{import_path}/index.js",
                f"src/{import_path}.ts",
                f"src/{import_path}.js"
            ]
            
            for path in potential_paths:
                try:
                    content = github_tools.fetch_github_file_content(owner, repo, path, branch)
                    if not content.startswith("Error"):
                        dependencies.add(path)
                        logger.info(f"Found TypeScript dependency: {path}")
                        break
                except Exception as e:
                    logger.debug(f"Could not fetch {path}: {e}")
                    continue
    
    return dependencies

def find_repository_files_by_pattern(owner: str, repo: str, patterns: List[str], branch: str = "main") -> Set[str]:
    """
    Find files in a GitHub repository matching specific patterns.
    
    Args:
        owner: Repository owner
        repo: Repository name  
        patterns: List of patterns to match (e.g., ["*.java", "Main.java"])
        branch: Branch to search
        
    Returns:
        Set of matching file paths
    """
    import github_tools
    
    # This is a simplified implementation
    # In practice, you'd use GitHub's tree API to get all files
    # For now, we'll try common patterns
    
    found_files = set()
    common_paths = [
        "src/main/java/",
        "src/",
        ""  # root
    ]
    
    for pattern in patterns:
        for base_path in common_paths:
            test_path = f"{base_path}{pattern}" if base_path else pattern
            try:
                content = github_tools.fetch_github_file_content(owner, repo, test_path, branch)
                if not content.startswith("Error"):
                    found_files.add(test_path)
                    logger.info(f"Found file: {test_path}")
            except Exception:
                continue
    
    return found_files

def generate_simple_multi_file_documentation(
    files_to_document: List[Dict[str, str]], 
    repository_url: str,
    branch: str = "main"
) -> str:
    """
    Generate simple multi-file documentation without using the AI agent (fallback).
    """
    from datetime import datetime
    
    result = f"""# Multi-File Repository Analysis (Simple Mode)

**Repository**: {repository_url}
**Branch**: {branch}
**Analysis Date**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Files Analyzed**: {len(files_to_document)}

## Files Included:
"""
    for file_data in files_to_document:
        result += f"- {file_data['path']}\n"
    
    result += "\n" + "="*80 + "\n\n"
    
    # Add basic file contents
    for i, file_data in enumerate(files_to_document, 1):
        result += f"""
## File {i}: {file_data['path']}

```
{file_data['content']}
```

---
"""
    
    result += "\n\n**Note**: This is a basic file listing. For comprehensive AI-powered analysis, ensure the code_documenter_agent is properly imported."
    
    return result

def find_target_files(root_dir: str, filename: Optional[str] = None, pattern: Optional[str] = None, debug: bool = False):
    """
    Find files by exact filename or pattern using enhanced FileSearcher.
    Cross-platform compatible with workspace detection.
    """
    from .file_searcher import FileSearcher
    
    # Configure logging if not already configured
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # If root_dir is not absolute or doesn't exist, try to get workspace root
    if not os.path.isabs(root_dir) or not os.path.exists(root_dir):
        workspace_root = FileSearcher.get_workspace_root()
        if root_dir and root_dir not in [".", "./"]:
            # Combine workspace root with relative path
            root_dir = os.path.join(workspace_root, root_dir.lstrip('./'))
        else:
            root_dir = workspace_root
        logger.info(f"Using resolved root directory: {root_dir}")
    
    # Debug: List directory contents if requested or if no files found initially
    if debug:
        logger.info("=== DEBUG: Directory structure ===")
        FileSearcher.list_directory_contents(root_dir)
        logger.info("=== END DEBUG ===")
    
    if filename:
        matches = FileSearcher.find_files(root_dir, filename)
    elif pattern:
        matches = FileSearcher.find_files_by_pattern(root_dir, pattern)
    else:
        raise ValueError("Either filename or pattern must be provided.")
    
    # If no matches found and debug wasn't requested, show directory structure for troubleshooting
    if not matches and not debug:
        logger.warning("No files found. Showing directory structure for troubleshooting:")
        FileSearcher.list_directory_contents(root_dir, max_depth=3)
    
    return matches

def code_documenter_agent_with_chunking(prompt: str, include_analysis: bool = True) -> str:
    """
    Enhanced version that handles long content by chunking.
    """
    # Azure OpenAI API limit is 256,000 characters
    API_LIMIT = 256000
    # Buffer for additional prompt text and safety margin
    SAFETY_BUFFER = 5000
    
    if len(prompt) > API_LIMIT - SAFETY_BUFFER:
        logger.warning(f"Content too long ({len(prompt)} chars), implementing chunking strategy...")
        logger.info(f"API limit: {API_LIMIT}, Safety buffer: {SAFETY_BUFFER}, Threshold: {API_LIMIT - SAFETY_BUFFER}")
        
        # Extract instruction and code parts
        code_start = prompt.find("## Code to Analyze:")
        if code_start != -1:
            instruction_part = prompt[:code_start + len("## Code to Analyze:\n")]
            code_part = prompt[code_start + len("## Code to Analyze:\n"):]
            logger.info(f"Found code section marker. Instruction part: {len(instruction_part)} chars, Code part: {len(code_part)} chars")
        else:
            instruction_part = ANALYSIS_INSTRUCTION
            code_part = prompt
            logger.info(f"No code section marker found. Using full prompt as code part: {len(code_part)} chars")
        
        # Calculate max chunk size accounting for instruction templates
        # First chunk uses full analysis instruction, subsequent chunks use shorter instruction
        first_chunk_instruction_size = len(instruction_part)
        subsequent_chunk_instruction_size = len(CHUNK_INSTRUCTION)
        
        # Calculate chunk sizes with proper overhead accounting
        first_chunk_max_size = API_LIMIT - first_chunk_instruction_size - SAFETY_BUFFER
        subsequent_chunk_max_size = API_LIMIT - subsequent_chunk_instruction_size - SAFETY_BUFFER
        
        logger.info(f"First chunk max size: {first_chunk_max_size}, Subsequent chunks max size: {subsequent_chunk_max_size}")
        
        # Split the code into chunks
        chunks = []
        if len(code_part) <= first_chunk_max_size:
            chunks = [code_part]
        else:
            # Create first chunk
            first_chunk = code_part[:first_chunk_max_size]
            # Find a good breaking point for the first chunk
            last_newline = first_chunk.rfind('\n')
            if last_newline > first_chunk_max_size * 0.8:  # If newline is in last 20%, use it
                first_chunk = first_chunk[:last_newline]
                remaining_code = code_part[last_newline + 1:]
            else:
                remaining_code = code_part[first_chunk_max_size:]
            
            chunks.append(first_chunk)
            
            # Split remaining code for subsequent chunks
            remaining_chunks = split_code_intelligently(remaining_code, subsequent_chunk_max_size)
            chunks.extend(remaining_chunks)
        
        logger.info(f"Split into {len(chunks)} chunks")
        
        all_analyses = []
        all_documented_code = []
        
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            
            # Validate chunk is not empty
            if not chunk or not chunk.strip():
                logger.warning(f"Chunk {i+1} is empty, skipping...")
                all_documented_code.append(f"// Chunk {i+1} was empty")
                continue
            
            # Use different instruction templates for first vs subsequent chunks
            if i == 0:
                chunk_prompt = f"""{instruction_part}\n{chunk}\n\nNote: This is part {i+1} of {len(chunks)} of a larger file. Please provide comprehensive analysis for this first part."""
            else:
                chunk_prompt = f"""{CHUNK_INSTRUCTION}\n{chunk}\n\nNote: This is part {i+1} of {len(chunks)} of a larger file. Focus on documenting this code section."""
            
            # Validate chunk prompt is not empty
            if not chunk_prompt or not chunk_prompt.strip():
                logger.error(f"Chunk {i+1} prompt is empty, skipping...")
                all_documented_code.append(f"// Error: Chunk {i+1} prompt was empty")
                continue
            
            # Validate chunk prompt size before sending
            if len(chunk_prompt) > API_LIMIT - 1000:  # Small buffer for response
                logger.error(f"Chunk {i+1} prompt still too large ({len(chunk_prompt)} chars), skipping")
                all_documented_code.append(f"// Error: Chunk {i+1} too large to process")
                continue
            
            try:
                # Import the agent function to avoid circular dependency
                import code_documentation_tool
                
                result = code_documentation_tool.code_documenter_agent(chunk_prompt, include_analysis=(i == 0))
                if not result:
                    logger.error(f"Chunk {i+1} failed: Empty result")
                    all_documented_code.append(f"// Error processing chunk {i+1}: Empty result")
                    continue
                
                # Check if result is an actual error message (starts with "Error:")
                if result.strip().startswith("Error:"):
                    logger.error(f"Chunk {i+1} failed: {result}")
                    all_documented_code.append(f"// Error processing chunk {i+1}: {result}")
                    continue
                
                # Parse result for first chunk to get analysis, but also handle subsequent chunks
                if i == 0:
                    # First chunk should contain analysis
                    all_analyses.append(result)
                    # Extract documented code from first chunk
                    if "### PART 2: DOCUMENTED CODE" in result:
                        doc_code = result.split("### PART 2: DOCUMENTED CODE")[1].strip()
                        all_documented_code.append(doc_code)
                    else:
                        # Fallback parsing
                        if "=== DOCUMENTED CODE ===" in result:
                            doc_code = result.split("=== DOCUMENTED CODE ===")[1].strip()
                            all_documented_code.append(doc_code)
                        else:
                            all_documented_code.append(result)
                else:
                    # For subsequent chunks, check if they contain analysis (in case first chunk failed)
                    if not all_analyses and ("ANALYSIS" in result.upper() or "### PART 1:" in result):
                        logger.info(f"Found analysis in chunk {i+1} (first chunk may have failed)")
                        all_analyses.append(result)
                    
                    # Extract documented code from subsequent chunks
                    if "### PART 2: DOCUMENTED CODE" in result:
                        doc_code = result.split("### PART 2: DOCUMENTED CODE")[1].strip()
                        all_documented_code.append(doc_code)
                    elif "=== DOCUMENTED CODE ===" in result:
                        doc_code = result.split("=== DOCUMENTED CODE ===")[1].strip()
                        all_documented_code.append(doc_code)
                    else:
                        all_documented_code.append(result)
                        
            except Exception as e:
                logger.error(f"Error processing chunk {i+1}: {e}")
                all_documented_code.append(f"// Exception in chunk {i+1}: {e}")
                continue
        
        # Combine results
        if all_documented_code and any(doc.strip() and not doc.startswith("// Error") for doc in all_documented_code):
            # Extract analysis if available
            analysis = ""
            if all_analyses:
                first_result = all_analyses[0]
                if "### PART 1: COMPREHENSIVE ANALYSIS" in first_result:
                    analysis = first_result.split("### PART 2: DOCUMENTED CODE")[0].replace("### PART 1: COMPREHENSIVE ANALYSIS", "").strip()
                elif "### PART 1: CHUNK ANALYSIS" in first_result:
                    analysis = first_result.split("### PART 2: DOCUMENTED CODE")[0].replace("### PART 1: CHUNK ANALYSIS", "").strip()
                elif "=== ANALYSIS ===" in first_result:
                    analysis = first_result.split("=== DOCUMENTED CODE ===")[0].replace("=== ANALYSIS ===", "").strip()
            
            if not analysis:
                analysis = f"Analysis completed for {len(chunks)} chunks."
            
            # Combine all documented code parts
            valid_code_parts = [doc for doc in all_documented_code if doc.strip() and not doc.startswith("// Error")]
            combined_documented_code = '\n\n'.join(valid_code_parts)
            
            combined_result = f"""### PART 1: COMPREHENSIVE ANALYSIS

{analysis}

Note: This file was processed in {len(chunks)} chunks due to size constraints.

### PART 2: DOCUMENTED CODE

{combined_documented_code}"""
            
            logger.info(f"Successfully combined results from {len(valid_code_parts)} chunks")
            return combined_result
        else:
            error_msg = f"Failed to process large file - no valid documented code generated from {len(chunks)} chunks"
            logger.error(error_msg)
            return f"Error: {error_msg}"
    else:
        logger.info(f"Prompt size ({len(prompt)} chars) is within limits, using standard agent")
        # Import the agent function to avoid circular dependency
        import code_documentation_tool
        return code_documentation_tool.code_documenter_agent(prompt, include_analysis)

def process_large_file(prompt: str, original_path: Optional[str] = None) -> Tuple[str, str]:
    """
    Process large files based on configured strategy.
    Returns tuple of (analysis, documented_code)
    """
    operation = detect_operation_type(prompt)
    
    if operation == "chunk_processing":
        result = code_documenter_agent_with_chunking(prompt, include_analysis=True)
    else:
        # For very large files, handle based on strategy
        result = handle_large_content(prompt, LARGE_FILE_STRATEGY)
    
    # Parse result into analysis and code parts
    try:
        from .response_parser import parse_analysis_and_code
        analysis, documented_code = parse_analysis_and_code(result)
        return analysis, documented_code
    except Exception as e:
        logger.warning(f"Could not parse analysis and code separately: {e}")
        return result, ""

def generate_multi_file_documentation(
    files_to_document: List[Dict[str, str]], 
    repository_url: str,
    branch: str = "main"
) -> str:
    """
    Generate comprehensive documentation for multiple related files.
    
    Args:
        files_to_document: List of dicts with 'path' and 'content' keys
        repository_url: URL of the repository being documented
        branch: Branch being analyzed
        
    Returns:
        Comprehensive documentation covering all files and their relationships
    """
    # Import here to avoid circular imports
    try:
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        tools_path = os.path.abspath(os.path.join(current_dir, '..', 'tools', 'review_document_tools'))
        if tools_path not in sys.path:
            sys.path.insert(0, tools_path)
        # Import only the function we need to avoid circular dependency
        import code_documentation_tool
    except ImportError as e:
        logger.error(f"Could not import code_documenter_agent: {e}")
        # Return a simple documentation instead of failing
        return generate_simple_multi_file_documentation(files_to_document, repository_url, branch)
    
    if not files_to_document:
        return "❌ Error: No files provided for documentation"
    
    # Create a comprehensive prompt that includes all files
    prompt_parts = [
        f"Repository Analysis and Documentation Request",
        f"Repository: {repository_url}",
        f"Branch: {branch}",
        f"Total Files: {len(files_to_document)}",
        "",
        "Please provide comprehensive analysis and documentation for this multi-file codebase.",
        "Focus on:",
        "1. Individual file analysis and documentation",
        "2. Inter-file relationships and dependencies", 
        "3. Overall architecture and design patterns",
        "4. Security considerations across the codebase",
        "5. Performance implications of the design",
        "",
        "FILES TO ANALYZE:",
        ""
    ]
    
    # Add each file with clear separation
    for i, file_info in enumerate(files_to_document, 1):
        prompt_parts.extend([
            f"=== FILE {i}: {file_info['path']} ===",
            "",
            file_info['content'],
            "",
            f"=== END OF FILE {i} ===",
            ""
        ])
    
    # Add specific instructions for multi-file analysis
    prompt_parts.extend([
        "",
        "MULTI-FILE ANALYSIS REQUIREMENTS:",
        "- Document each file individually with proper headers",
        "- Identify and explain relationships between files",
        "- Highlight any dependency issues or circular dependencies",
        "- Assess the overall architecture quality",
        "- Provide recommendations for improvements",
        "- Consider security implications across all files",
        "- Evaluate error handling and logging consistency"
    ])
    
    full_prompt = "\n".join(prompt_parts)
    
    logger.info(f"Generating documentation for {len(files_to_document)} files")
    logger.info(f"Total prompt length: {len(full_prompt)} characters")
    
    try:
        # Generate documentation using the existing agent
        result = code_documentation_tool.code_documenter_agent(full_prompt, include_analysis=True)
        
        # Add metadata header
        from datetime import datetime
        metadata_header = f"""# Repository Documentation Report

**Repository:** {repository_url}  
**Branch:** {branch}  
**Files Analyzed:** {len(files_to_document)}  
**Analysis Date:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  

## Files Included in Analysis:
"""
        
        for i, file_info in enumerate(files_to_document, 1):
            metadata_header += f"{i}. `{file_info['path']}`\n"
        
        metadata_header += "\n---\n\n"
        
        return metadata_header + result
        
    except Exception as e:
        logger.error(f"Multi-file documentation failed: {e}", exc_info=True)
        return f"❌ Error generating multi-file documentation: {str(e)}"

def split_code_intelligently(code: str, max_chunk_size: int = LARGE_FILE_THRESHOLD) -> List[str]:
    """
    Split code intelligently by preserving class and method boundaries.
    
    Args:
        code: Source code to split
        max_chunk_size: Maximum size per chunk
        
    Returns:
        List of code chunks
    """
    if len(code) <= max_chunk_size:
        return [code]
    
    chunks = []
    lines = code.split('\n')
    current_chunk = []
    current_size = 0
    
    # Try to split at class boundaries for Java
    class_pattern = r'^\s*(public|private|protected)?\s*(static\s+)?(class|interface|enum)\s+\w+'
    
    for line in lines:
        line_size = len(line) + 1  # +1 for newline
        
        # If adding this line would exceed the chunk size
        if current_size + line_size > max_chunk_size and current_chunk:
            chunks.append('\n'.join(current_chunk))
            current_chunk = []
            current_size = 0
        
        current_chunk.append(line)
        current_size += line_size
    
    # Add the last chunk if it has content
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    
    logger.info(f"Split code into {len(chunks)} chunks")
    return chunks

def create_code_summary(code: str, max_length: int = 50000) -> str:
    """
    Create a summary of code for analysis when the full code is too large.
    
    Args:
        code: Source code to summarize
        max_length: Maximum length of summary
        
    Returns:
        Code summary with key components
    """
    if len(code) <= max_length:
        return code
    
    lines = code.split('\n')
    summary_lines = []
    
    # Always include imports and package declarations
    for line in lines[:50]:  # First 50 lines usually contain imports
        if (line.strip().startswith('import ') or 
            line.strip().startswith('package ') or
            line.strip().startswith('/*') or
            line.strip().startswith('*') or
            line.strip().startswith('//')):
            summary_lines.append(line)
    
    summary_lines.append("\n// ... [CODE SUMMARY - showing key components] ...\n")
    
    # Include class/interface declarations and method signatures
    in_comment = False
    for line in lines:
        stripped = line.strip()
        
        # Track multi-line comments
        if '/*' in stripped:
            in_comment = True
        if '*/' in stripped:
            in_comment = False
            continue
            
        if in_comment:
            continue
        
        # Include important declarations
        if (stripped.startswith('public class ') or
            stripped.startswith('private class ') or
            stripped.startswith('public interface ') or
            stripped.startswith('public enum ') or
            (stripped.startswith('public ') and '(' in stripped and '{' in stripped) or
            (stripped.startswith('private ') and '(' in stripped and '{' in stripped)):
            summary_lines.append(line)
            
        # Stop if we're getting too long
        if len('\n'.join(summary_lines)) > max_length:
            break
    
    summary = '\n'.join(summary_lines)
    logger.info(f"Created code summary: {len(summary)} chars from {len(code)} chars")
    return summary

def handle_large_content(content: str, strategy: str = LARGE_FILE_STRATEGY) -> str:
    """
    Handle large content based on the configured strategy.
    
    Args:
        content: Content to process
        strategy: Strategy to use (chunk, summarize, truncate, reject)
        
    Returns:
        Processed content
    """
    if len(content) <= LARGE_FILE_THRESHOLD:
        return content
    
    if strategy == LargeFileStrategy.SUMMARIZE:
        return create_code_summary(content)
    elif strategy == LargeFileStrategy.TRUNCATE:
        return content[:LARGE_FILE_THRESHOLD] + "\n\n[... Content truncated ...]"
    elif strategy == LargeFileStrategy.REJECT:
        raise ValueError(f"Content too large ({len(content)} chars) and strategy is REJECT")
    else:  # Default to CHUNK strategy
        # For chunk strategy, return the content as-is and let the caller handle chunking
        return content

# def is_safe_path(basedir: str, path: str, follow_symlinks: bool = True) -> bool:
#     """
#     Check if a path is safe to access (prevents directory traversal attacks).
    
#     Args:
#         basedir: Base directory to check against
#         path: Path to validate
#         follow_symlinks: Whether to follow symbolic links
        
#     Returns:
#         True if path is safe, False otherwise
#     """
#     try:
#         if follow_symlinks:
#             return os.path.commonpath([basedir, os.path.realpath(path)]) == basedir
#         else:
#             return os.path.commonpath([basedir, os.path.abspath(path)]) == basedir
#     except (ValueError, OSError):
#         return False

def detect_operation_type(prompt: str) -> str:
    """
    Detect the type of operation requested in the prompt.
    
    Args:
        prompt: User prompt to analyze
        
    Returns:
        Operation type string
    """
    prompt_lower = prompt.lower()
    
    # Check for GitHub repository URLs
    if 'github.com' in prompt_lower or 'repository' in prompt_lower:
        return 'repository_analysis'
    
    # Check for analysis keywords
    if any(keyword in prompt_lower for keyword in ['analysis', 'analyze', 'review', 'assess']):
        return 'code_analysis'
    
    # Check for documentation keywords
    if any(keyword in prompt_lower for keyword in ['document', 'documentation', 'comment']):
        return 'code_documentation'
    
    # Default to general code processing
    return 'general'

def save_documented_code(original_path: str, documented_code: str, suffix: str = "_documented") -> str:
    """
    Save documented code to a file with the specified suffix.
    
    Args:
        original_path: Original file path
        documented_code: Documented code content
        suffix: Suffix to add to filename
        
    Returns:
        Path to the saved file
    """
    # Check if original_path is a GitHub URL - skip local save
    github_url_patterns = [
        r"https://github\.com/",
        r"git@github\.com:",
        r"github\.com/"
    ]
    
    if any(re.search(pattern, str(original_path), re.IGNORECASE) for pattern in github_url_patterns):
        logger.warning(f"GitHub URL detected in save_documented_code: {original_path}")
        logger.warning("Skipping local file save for GitHub URL")
        return f"skipped_github_url_{suffix}"
    
    try:
        path_obj = Path(original_path)
        documented_path = path_obj.parent / f"{path_obj.stem}{suffix}{path_obj.suffix}"
        
        with open(documented_path, 'w', encoding='utf-8') as f:
            f.write(documented_code)
        
        logger.info(f"Saved documented code to: {documented_path}")
        return str(documented_path)
        
    except Exception as e:
        logger.error(f"Failed to save documented code: {e}")
        raise

def save_analysis_part(original_path: str, analysis: str) -> str:
    """
    Save analysis part to a separate file.
    
    Args:
        original_path: Original file path
        analysis: Analysis content
        
    Returns:
        Path to the saved analysis file
    """
    # Check if original_path is a GitHub URL - skip local save
    github_url_patterns = [
        r"https://github\.com/",
        r"git@github\.com:",
        r"github\.com/"
    ]
    
    if any(re.search(pattern, str(original_path), re.IGNORECASE) for pattern in github_url_patterns):
        logger.warning(f"GitHub URL detected in save_analysis_part: {original_path}")
        logger.warning("Skipping local analysis save for GitHub URL")
        return "skipped_github_url_analysis"
    
    try:
        path_obj = Path(original_path)
        ext_no_dot = path_obj.suffix[1:] if path_obj.suffix else ""
        # Use filename pattern consistent with GitHub mode: <stem>_analysis_<ext>.md
        analysis_filename = f"{path_obj.stem}_analysis_{ext_no_dot}.md" if ext_no_dot else f"{path_obj.stem}_analysis.md"
        analysis_path = path_obj.parent / analysis_filename

        with open(analysis_path, 'w', encoding='utf-8') as f:
            f.write(analysis)

        logger.info(f"Saved analysis to: {analysis_path}")
        return str(analysis_path)

    except Exception as e:
        logger.error(f"Failed to save analysis: {e}")
        raise