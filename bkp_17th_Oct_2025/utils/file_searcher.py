"""
Cross-platform file searcher utility for AIVA MCP Server
Enhanced for Copilot workspace compatibility with robust cross-platform support.

Version: 1.0.0
Date: 08/sep/2025
Author: Sabyasachi S
"""

import os
import platform
import logging
from typing import List, Optional
from pathlib import Path
import fnmatch

logger = logging.getLogger(__name__)

class FileSearcher:
    """
    Cross-platform utility class to search for files by name or pattern across Windows, macOS, and Linux.
    Enhanced for Copilot workspace compatibility with robust cross-platform support.
    """
    
    @staticmethod
    def _is_hidden_directory(dir_name: str) -> bool:
        """
        Cross-platform check for hidden directories.
        """
        system = platform.system().lower()
        
        # Common hidden directories across all platforms
        common_hidden = {'.git', '.vscode', '.idea', '__pycache__', 'node_modules', 
                        '.pytest_cache', '.mypy_cache', '.tox', 'venv', '.venv'}
        
        if dir_name in common_hidden:
            return True
            
        # Unix-like systems (Linux, macOS): directories starting with '.'
        if system in ['linux', 'darwin'] and dir_name.startswith('.'):
            return True
            
        # Windows: check for hidden attribute (if accessible) or common patterns
        if system == 'windows':
            if dir_name.startswith('.'):
                return True
            # Windows-specific hidden folders
            windows_hidden = {'System Volume Information', '$RECYCLE.BIN', 'pagefile.sys'}
            if dir_name in windows_hidden:
                return True
                
        return False
    
    @staticmethod
    def _normalize_path(path: str) -> Path:
        """
        Normalize and resolve path across all platforms.
        """
        try:
            # Convert to Path object and resolve
            normalized = Path(path).expanduser().resolve()
            return normalized
        except (OSError, RuntimeError) as e:
            logger.warning(f"Could not normalize path '{path}': {e}")
            # Fallback to basic Path conversion
            return Path(path)
    
    @staticmethod
    def _safe_walk(root_path: Path) -> List[tuple]:
        """
        Safe directory walking with cross-platform error handling.
        """
        results = []
        
        try:
            for root, dirs, files in os.walk(str(root_path), followlinks=False):
                # Filter out hidden directories in-place
                dirs[:] = [d for d in dirs if not FileSearcher._is_hidden_directory(d)]
                
                # On case-insensitive systems, we might have duplicate issues
                # Sort to ensure consistent behavior
                dirs.sort()
                files.sort()
                
                results.append((root, dirs, files))
                
        except (PermissionError, OSError, UnicodeDecodeError) as e:
            logger.warning(f"Error walking directory {root_path}: {e}")
            
        return results
    
    @staticmethod
    def _is_case_sensitive_filesystem(path: Path) -> bool:
        """
        Detect if the filesystem is case-sensitive.
        """
        system = platform.system().lower()
        
        # Quick determination based on OS
        if system == 'linux':
            return True
        elif system == 'windows':
            return False
        elif system == 'darwin':  # macOS
            # macOS can be either, but default is case-insensitive
            # Try to detect by creating test files
            try:
                test_path = path / "CasE_TeSt_FiLe.tmp"
                test_path_lower = path / "case_test_file.tmp"
                
                if test_path.exists() or test_path_lower.exists():
                    return True  # Default to case-sensitive if we can't test
                    
                # Create test file
                test_path.touch()
                case_sensitive = not test_path_lower.exists()
                test_path.unlink()  # Clean up
                return case_sensitive
                
            except (OSError, PermissionError):
                return False  # Default to case-insensitive for macOS
        
        return True  # Default to case-sensitive for unknown systems

    @staticmethod
    def find_files(root_dir: str, filename: str) -> List[str]:
        """
        Recursively search for files with the given filename under root_dir.
        Cross-platform compatible with proper case handling.
        """
        matches = []
        root_path = FileSearcher._normalize_path(root_dir)
        
        logger.info(f"Searching for '{filename}' in: {root_path} (OS: {platform.system()})")
        
        if not root_path.exists():
            logger.error(f"Root directory does not exist: {root_path}")
            return matches
            
        if not root_path.is_dir():
            logger.error(f"Root path is not a directory: {root_path}")
            return matches

        # Determine if we need case-insensitive matching
        case_sensitive = FileSearcher._is_case_sensitive_filesystem(root_path)
        search_filename = filename if case_sensitive else filename.lower()
        
        for root, dirs, files in FileSearcher._safe_walk(root_path):
            for file in files:
                compare_file = file if case_sensitive else file.lower()
                if compare_file == search_filename:
                    full_path = os.path.join(root, file)
                    matches.append(full_path)
                    logger.info(f"Found match: {full_path}")
                        
        logger.info(f"Total matches found: {len(matches)} (case_sensitive: {case_sensitive})")
        return matches

    @staticmethod
    def find_files_by_pattern(root_dir: str, pattern: str) -> List[str]:
        """
        Recursively search for files matching the pattern.
        Cross-platform compatible with proper case handling.
        """
        matches = []
        root_path = FileSearcher._normalize_path(root_dir)
        
        logger.info(f"Searching for pattern '{pattern}' in: {root_path} (OS: {platform.system()})")
        
        if not root_path.exists():
            logger.error(f"Root directory does not exist: {root_path}")
            return matches
            
        if not root_path.is_dir():
            logger.error(f"Root path is not a directory: {root_path}")
            return matches

        # Determine if we need case-insensitive matching
        case_sensitive = FileSearcher._is_case_sensitive_filesystem(root_path)
        search_pattern = pattern if case_sensitive else pattern.lower()

        for root, dirs, files in FileSearcher._safe_walk(root_path):
            for file in files:
                compare_file = file if case_sensitive else file.lower()
                if fnmatch.fnmatch(compare_file, search_pattern):
                    full_path = os.path.join(root, file)
                    matches.append(full_path)
                    logger.info(f"Found match: {full_path}")
                        
        logger.info(f"Total matches found: {len(matches)} (case_sensitive: {case_sensitive})")
        return matches

    @staticmethod
    def get_workspace_root() -> str:
        """
        Cross-platform workspace root detection for various environments.
        """
        # Environment variables to check (in order of preference)
        workspace_vars = [
            'GITHUB_WORKSPACE',           # GitHub Actions
            'CODESPACE_VSCODE_FOLDER',    # GitHub Codespaces
            'WORKSPACE_FOLDER',           # Generic workspace
            'PROJECT_ROOT',               # Some IDEs
            'PWD',                        # Current directory (Unix)
            'CD',                         # Current directory (Windows)
        ]
        
        system = platform.system().lower()
        
        for var in workspace_vars:
            if var in os.environ:
                workspace_path = FileSearcher._normalize_path(os.environ[var])
                if workspace_path.exists() and workspace_path.is_dir():
                    logger.info(f"Detected workspace root from {var}: {workspace_path}")
                    return str(workspace_path)
        
        # Platform-specific fallbacks
        if system == 'windows':
            # Try to find common project indicators in current directory tree
            current = Path.cwd()
            for parent in [current] + list(current.parents):
                if any((parent / indicator).exists() for indicator in 
                       ['.git', '.vscode', 'package.json', 'requirements.txt', 'pom.xml']):
                    logger.info(f"Found project root at: {parent}")
                    return str(parent)
        
        # Final fallback to current working directory
        cwd = Path.cwd().resolve()
        logger.info(f"Using current working directory as workspace root: {cwd}")
        return str(cwd)

    @staticmethod
    def get_os_info() -> dict:
        """
        Get comprehensive OS information for debugging.
        """
        return {
            'system': platform.system(),
            'release': platform.release(),
            'version': platform.version(),
            'machine': platform.machine(),
            'processor': platform.processor(),
            'architecture': platform.architecture(),
            'python_version': platform.python_version(),
            'cwd': str(Path.cwd()),
            'home': str(Path.home()),
        }

    @staticmethod
    def list_directory_contents(directory: str, max_depth: int = 2) -> None:
        """
        Cross-platform debug helper to list directory contents.
        """
        root_path = FileSearcher._normalize_path(directory)
        logger.info(f"Directory contents for: {root_path}")
        logger.info(f"OS Info: {FileSearcher.get_os_info()}")
        
        if not root_path.exists():
            logger.error(f"Directory does not exist: {root_path}")
            return
            
        try:
            for root, dirs, files in FileSearcher._safe_walk(root_path):
                level = root.replace(str(root_path), '').count(os.sep)
                if level >= max_depth:
                    dirs[:] = []  # Don't recurse deeper
                    continue
                    
                indent = ' ' * 2 * level
                logger.info(f'{indent}{os.path.basename(root)}/')
                
                # Show a few directories
                subindent = ' ' * 2 * (level + 1)
                for dir_name in dirs[:5]:
                    logger.info(f'{subindent}{dir_name}/')
                if len(dirs) > 5:
                    logger.info(f'{subindent}... and {len(dirs) - 5} more directories')
                
                # Show a few files
                for file in files[:10]:
                    logger.info(f'{subindent}{file}')
                if len(files) > 10:
                    logger.info(f'{subindent}... and {len(files) - 10} more files')
                    
        except Exception as e:
            logger.error(f"Error listing directory {root_path}: {e}")


# Enhanced command-line interface
if __name__ == "__main__":
    import argparse
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    parser = argparse.ArgumentParser(
        description="Cross-platform file searcher with Copilot workspace support."
    )
    parser.add_argument("root_dir", nargs='?', default=".", 
                       help="Root directory to start search (default: current directory)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--filename", help="Exact filename to search for")
    group.add_argument("--pattern", help="Pattern (wildcard *) to search for")
    parser.add_argument("--debug", action="store_true", 
                       help="Show debug information and directory contents")
    args = parser.parse_args()

    # Use workspace root if root_dir is current directory
    if args.root_dir == ".":
        args.root_dir = FileSearcher.get_workspace_root()

    if args.debug:
        FileSearcher.list_directory_contents(args.root_dir)

    if args.filename:
        results = FileSearcher.find_files(args.root_dir, args.filename)
    else:
        results = FileSearcher.find_files_by_pattern(args.root_dir, args.pattern)

    if not results:
        print("No files found.")
    else:
        print(f"\nFound {len(results)} file(s):")
        for path in results:
            print(path)