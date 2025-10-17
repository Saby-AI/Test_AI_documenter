"""
Response parsing utilities for AIVA MCP Server
"""

import logging

logger = logging.getLogger(__name__)

def clean_documented_code(documented_code: str) -> str:
    """
    Clean the documented code section by removing analysis artifacts and non-code content.
    
    Args:
        documented_code: Raw documented code section
        
    Returns:
        Cleaned documented code without analysis artifacts
    """
    if not documented_code:
        return documented_code
    
    # Generic patterns to remove from documented code (language-agnostic)
    # IMPORTANT: Be very careful not to remove valid code comments that are part of the documentation
    removal_patterns = [
        # Specific analysis markers that should NOT be in code files
        r"=== ANALYSIS ===.*?(?=\n=== |^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"# === PART 2: DOCUMENTED SOURCE CODE ===.*?(?=\n)",
        r"### PART 2: DOCUMENTED SOURCE CODE.*?(?=\n)",
        
        # TypeScript Implementation Checklist - can appear after code blocks
        r"```\s*\n### TypeScript Implementation Checklist Status:.*?(?=\n### PART|\n```|\Z)",
        r"### TypeScript Implementation Checklist Status:.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✓ Type Annotation Coverage:\*\*.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✓ 'any' Type Usage:\*\*.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✓ Type Aliases:\*\*.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✗ Generic Usage:\*\*.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✗ Null Safety:\*\*.*?(?=\n### PART|\n```|\Z)",
        r"\*\*✗ Decorator Usage:\*\*.*?(?=\n### PART|\n```|\Z)",
        
        # Summary and priority sections
        r"### Summary Score:.*?(?=\n### PART|\n```|\Z)",
        r"### Priority Improvements:.*?(?=\n### PART|\n```|\Z)",
        r"TypeScript Best Practices Score:.*?(?=\n### PART|\n```|\Z)",
        
        # Analysis sections with numbered headings (#### 1., ### 2., etc.) - but only standalone ones
        r"^\s*#{2,4} \d+\. [A-Z][A-Z\s&]+.*?(?=\n^\s*#{2,4} \d+\.|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        
        # Analysis sections with named headings - but only standalone ones  
        r"^\s*#{2,4} [A-Z][A-Z\s&]+ EVALUATION.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} [A-Z][A-Z\s&]+ ASSESSMENT.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        
        # Executive Summary and other analysis sections that shouldn't be in code
        r"^\s*#{2,4} Executive Summary.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Code Overview.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Architecture Analysis.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Security Evaluation.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Performance.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Refactoring.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        r"^\s*#{2,4} Actionable Next Steps.*?(?=\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        
        # Security patterns (OWASP, etc.) - only when they're clearly analysis
        r"^\s*- \*\*A\d+:.*?(?=\n^\s*- \*\*A|\n^\s*#{2,4}|\n^\s*/\*\*|\n^\s*#|\n^\s*//|\n^\s*class |\n^\s*function |\n^\s*def |\n^\s*import |\n^\s*package |\Z)",
        
        # Analysis checkmarks and symbols - only standalone lines
        r"^\s*✓.*?(?=\n)",
        r"^\s*✗.*?(?=\n)",
        r"^\s*❌.*?(?=\n)",
        r"^\s*⚠️.*?(?=\n)",
        
        # Specific improvement recommendations
        r"- \*\*Implement stricter.*?(?=\n### PART|\n```|\Z)",
        r"- \*\*Switch to parameterized.*?(?=\n### PART|\n```|\Z)",
        r"- \*\*Enhance error handling.*?(?=\n### PART|\n```|\Z)",
        r"\d+\. \*\*.*?\*\*:.*?(?=\n\d+\.|\n### PART|\n```|\Z)",
        
        # GitHub operation messages and metadata - these are never valid code
        r"🎯 GitHub Operation.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"📁 Repository:.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"🌿 Branch:.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"📄 Documented file:.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"📊 Analysis file:.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"🔄 Operation type:.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"✨ No local files created.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        
        # Next step instructions - these are never valid code
        r"=== NEXT STEP ===.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"To commit this documented code to GitHub.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"operation='document_commit'.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"through \"### PART 2: DOCUMENTED CODE\".*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        
        # Additional GitHub commit instruction patterns
        r"file_path='.*?'.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"generated_code='<copy the ENTIRE response.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"confirm='yes'.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"⚠️.*?IMPORTANT.*?Copy the FULL response.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        r"starting from \"### PART 1.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
        
        # Horizontal rules and separators - only when standalone
        r"^\s*---+.*?(?=\n|^/\*\*|^#|^//|^class |^function |^def |^import |^package |\Z)",
    ]
    
    import re
    cleaned_code = documented_code
    
    for pattern in removal_patterns:
        cleaned_code = re.sub(pattern, "", cleaned_code, flags=re.DOTALL | re.MULTILINE)
    
    # Clean up excessive whitespace
    cleaned_code = re.sub(r'\n{3,}', '\n\n', cleaned_code)
    cleaned_code = cleaned_code.strip()
    
    logger.info(f"Cleaned documented code: {len(documented_code)} → {len(cleaned_code)} chars")
    
    return cleaned_code

def parse_analysis_and_code(agent_response: str) -> tuple[str, str]:
    """
    Parse the agent response to separate analysis sections from documented code.
    
    Args:
        agent_response (str): Full response from the documentation agent
        
    Returns:
        tuple[str, str]: (analysis_sections, documented_code)
    """
    try:
        if not agent_response:
            logger.error("Empty result received from AI agent")
            return "", ""

        logger.info(f"Parsing response of {len(agent_response)} characters")
        
        analysis_sections = ""
        documented_code = ""
        
        # Define all possible markers in order of preference
        part2_markers = [
            "### PART 2: DOCUMENTED CODE",
            "PART 2: DOCUMENTED CODE", 
            "## PART 2: DOCUMENTED CODE",
            "# PART 2: DOCUMENTED CODE",
            "=== PART 2: DOCUMENTED CODE ===",
            "## DOCUMENTED CODE",
            "### DOCUMENTED CODE",
            "DOCUMENTED CODE:",
            "=== DOCUMENTED CODE ===",
            "**DOCUMENTED CODE**",
            "DOCUMENTED CODE",
        ]
        
        part1_markers = [
            "### PART 1: COMPREHENSIVE ANALYSIS",
            "PART 1: COMPREHENSIVE ANALYSIS",
            "## PART 1: COMPREHENSIVE ANALYSIS", 
            "# PART 1: COMPREHENSIVE ANALYSIS",
            "=== PART 1: COMPREHENSIVE ANALYSIS ===",
            "## ANALYSIS",
            "### ANALYSIS", 
            "=== ANALYSIS ===",
            "**ANALYSIS**",
            "ANALYSIS:",
        ]
        
        # First, try to find PART 2 marker and split there
        found_part2 = False
        for marker in part2_markers:
            if marker in agent_response:
                logger.info(f"Found PART 2 marker: {marker}")
                parts = agent_response.split(marker, 1)
                if len(parts) == 2:
                    analysis_sections = parts[0].strip()
                    documented_code = parts[1].strip()
                    found_part2 = True
                    break
        
        # If we found PART 2, clean up PART 1 markers from analysis
        if found_part2 and analysis_sections:
            for a_marker in part1_markers:
                if a_marker in analysis_sections:
                    logger.info(f"Removing PART 1 marker: {a_marker}")
                    analysis_sections = analysis_sections.replace(a_marker, "", 1).strip()
                    break
        
        # If no PART 2 found, try alternative approaches
        if not found_part2:
            logger.info("No PART 2 marker found, trying alternative parsing")
            
            # Look for code block patterns
            code_patterns = [
                "```typescript", "```javascript", "```python", "```java", 
                "```cpp", "```c", "```html", "```css", "```sql", "```"
            ]
            
            for pattern in code_patterns:
                if pattern in agent_response:
                    # Find the first code block
                    code_start = agent_response.find(pattern)
                    if code_start > 100:  # Ensure there's enough content before for analysis
                        analysis_sections = agent_response[:code_start].strip()
                        documented_code = agent_response[code_start:].strip()
                        logger.info(f"Split on code pattern: {pattern}")
                        break
        
        # Final fallback: if still no split and response is large, try to split roughly
        if not documented_code and len(agent_response) > 1000:
            # Look for a natural break around the middle
            mid_point = len(agent_response) // 2
            # Find paragraph break near middle
            search_start = max(0, mid_point - 500)
            search_end = min(len(agent_response), mid_point + 500)
            search_section = agent_response[search_start:search_end]
            
            # Look for double newlines (paragraph breaks)
            paragraph_breaks = []
            for i, char in enumerate(search_section):
                if char == '\n' and i < len(search_section) - 1 and search_section[i+1] == '\n':
                    paragraph_breaks.append(search_start + i)
            
            if paragraph_breaks:
                split_point = paragraph_breaks[len(paragraph_breaks) // 2]
                analysis_sections = agent_response[:split_point].strip()
                documented_code = agent_response[split_point:].strip()
                logger.info("Used paragraph break fallback split")
        
        # Validate and provide fallbacks
        if not documented_code:
            logger.warning("Could not find documented code section, using full response as code")
            documented_code = agent_response.strip()
            analysis_sections = ""
            
        if not analysis_sections and documented_code == agent_response:
            logger.warning("No analysis section found, response treated as code only")
        
        # Clean up the documented code section
        if documented_code:
            documented_code = clean_documented_code(documented_code)
        
        # Log final results
        logger.info(f"Final parsing result - Analysis: {len(analysis_sections)} chars, Code: {len(documented_code)} chars")
        
        if documented_code and len(documented_code) > 30:
            logger.info(f"Successfully parsed: Analysis ({len(analysis_sections)} chars), Code ({len(documented_code)} chars)")
            return analysis_sections, documented_code
        else:
            logger.warning(f"Documented code section too short ({len(documented_code)} chars), returning full response as code")
            return "", agent_response.strip()
        
    except Exception as e:
        logger.error(f"Error parsing analysis and code: {str(e)}")
        # Fallback: return original response as code
        return "", agent_response


def test_parsing_with_sample(sample_response: str) -> None:
    """
    Test the parsing function with a sample response for debugging.
    
    Args:
        sample_response: Sample agent response to test parsing
    """
    print("=== TESTING RESPONSE PARSING ===")
    print(f"Input length: {len(sample_response)}")
    print(f"First 200 chars: {sample_response[:200]}...")
    print(f"Last 200 chars: ...{sample_response[-200:]}")
    
    # Test parsing
    analysis, code = parse_analysis_and_code(sample_response)
    
    print(f"\nParsing Results:")
    print(f"Analysis length: {len(analysis)}")
    print(f"Code length: {len(code)}")
    
    if analysis:
        print(f"Analysis preview: {analysis[:100]}...")
    else:
        print("Analysis: EMPTY")
        
    if code:
        print(f"Code preview: {code[:100]}...")
    else:
        print("Code: EMPTY")
    
    print("=== END TEST ===")


def debug_agent_response(agent_response: str) -> dict:
    """
    Analyze an agent response to help debug parsing issues.
    
    Args:
        agent_response: The raw response from the agent
        
    Returns:
        Dict with debugging information
    """
    debug_info = {
        "response_length": len(agent_response),
        "has_part1_marker": False,
        "has_part2_marker": False,
        "part1_markers_found": [],
        "part2_markers_found": [],
        "has_code_blocks": False,
        "code_block_languages": [],
        "line_count": len(agent_response.split('\n')),
        "paragraph_count": len([p for p in agent_response.split('\n\n') if p.strip()]),
    }
    
    # Check for PART markers
    part1_markers = [
        "### PART 1: COMPREHENSIVE ANALYSIS",
        "PART 1: COMPREHENSIVE ANALYSIS", 
        "## ANALYSIS",
        "=== ANALYSIS ===",
    ]
    
    part2_markers = [
        "### PART 2: DOCUMENTED CODE",
        "PART 2: DOCUMENTED CODE",
        "## DOCUMENTED CODE", 
        "=== DOCUMENTED CODE ===",
    ]
    
    for marker in part1_markers:
        if marker in agent_response:
            debug_info["has_part1_marker"] = True
            debug_info["part1_markers_found"].append(marker)
    
    for marker in part2_markers:
        if marker in agent_response:
            debug_info["has_part2_marker"] = True
            debug_info["part2_markers_found"].append(marker)
    
    # Check for code blocks
    import re
    code_blocks = re.findall(r'```(\w+)?', agent_response)
    if code_blocks:
        debug_info["has_code_blocks"] = True
        debug_info["code_block_languages"] = [lang for lang in code_blocks if lang]
    
    return debug_info
