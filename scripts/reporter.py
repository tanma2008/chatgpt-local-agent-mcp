import subprocess
import os
import sys

REPORTER_PS1 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "windows-reporter.ps1")

def report_status(status: str, title: str, message: str = "", percent: int = -1, timeout: int = 5, async_mode: bool = True) -> bool:
    """
    Send a Windows Report Popup status update for AI Commander jobs.
    Statuses: RUNNING, PROGRESS, COMPLETED, ERROR
    """
    cmd = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", REPORTER_PS1,
        "-Status", status,
        "-Title", title,
        "-Message", message,
        "-TimeoutSeconds", str(timeout)
    ]
    if percent >= 0:
        cmd.extend(["-Percent", str(percent)])
    if async_mode:
        cmd.append("-Async")
        
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return res.returncode == 0
    except Exception as e:
        print(f"[ReporterError] Failed to trigger popup: {e}", file=sys.stderr)
        return False

class WorkflowReporter:
    """
    Context manager and helper class for AI Commander workflow jobs.
    
    Usage:
        with WorkflowReporter("Data Sync Job", "Starting sync...") as r:
            r.progress(35, "Fetching records...")
            # do work...
            r.progress(80, "Writing database...")
            # finished automatically with COMPLETED popup
    """
    def __init__(self, title: str, initial_msg: str = "Task started...", timeout: int = 4):
        self.title = title
        self.timeout = timeout
        report_status("RUNNING", self.title, initial_msg, timeout=self.timeout, async_mode=True)

    def progress(self, percent: int, msg: str = ""):
        report_status("PROGRESS", self.title, msg, percent=percent, timeout=self.timeout, async_mode=True)

    def completed(self, msg: str = "Task completed successfully.", timeout: int = 5):
        report_status("COMPLETED", self.title, msg, percent=100, timeout=timeout, async_mode=True)

    def error(self, msg: str = "Task encountered an error.", timeout: int = 8):
        report_status("ERROR", self.title, msg, timeout=timeout, async_mode=True)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.error(f"{exc_type.__name__}: {exc_val}")
        else:
            self.completed()
        return False
