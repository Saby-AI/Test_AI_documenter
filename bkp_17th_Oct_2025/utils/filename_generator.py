"""
Filename generation utilities for documented files
"""

import logging
import sys
import os

logger = logging.getLogger(__name__)

# Constants
DEFAULT_DOCUMENTED_SUFFIX = "_documented"

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
    Version numbers are not used; overwrites existing documented files if present.
    
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

def save_analysis_part(original_path: str, analysis: str):
    """
    Save the analysis part to a new file with the _analysis_fileExtension.doc pattern.
    Args:
        original_path (str): The original file path (e.g., "server.py" or "src/utils.js")
        analysis (str): The analysis text to save
    """
    import os
    base = os.path.basename(original_path)
    name, ext = os.path.splitext(base)
    ext = ext.lstrip(".")
    analysis_filename = f"{name}_analysis_{ext}.doc"
    analysis_path = os.path.abspath(analysis_filename)
    output_dir = os.path.dirname(analysis_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    with open(analysis_path, "w", encoding="utf-8") as f:
        f.write(analysis)
    logger.info(f"Analysis saved to: {analysis_path}")
