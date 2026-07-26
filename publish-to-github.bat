@echo off
chcp 65001 >NUL
cd /d "%~dp0"
echo ============================================
echo   Dayflow - publish to GitHub and build EXE
echo ============================================
echo.

REM [1/5] Install the updated workflow file (this path could not be written remotely)
if exist windows-build.yml.new (
  if not exist .github\workflows mkdir .github\workflows
  move /Y windows-build.yml.new .github\workflows\windows-build.yml >NUL
  echo [1/5] Workflow file installed.
) else (
  echo [1/5] Workflow file already in place.
)

REM [2/5] Git identity (only set if missing)
git config user.name >NUL 2>&1 || git config user.name "wuyuanzhan43-cyber"
git config user.email >NUL 2>&1 || git config user.email "wuyuanzhan43-cyber@users.noreply.github.com"

git add -A
git commit -m "release: Dayflow v0.8.0"
echo [2/5] Changes committed.

REM [3/5] Point at the GitHub repository
git remote remove origin >NUL 2>&1
git remote add origin https://github.com/wuyuanzhan43-cyber/task_planning.git
git branch -M main
echo [3/5] Remote configured.

REM [4/5] Push main branch
git push -u origin main
if errorlevel 1 (
  echo.
  echo Push was rejected. If the GitHub repo was created with a README,
  echo run this command once, then re-run this script:
  echo.
  echo     git push -u origin main --force
  echo.
  pause
  exit /b 1
)
echo [4/5] main branch pushed.

REM [5/5] Push release tag (triggers installer build + GitHub Release)
git tag -f v0.8.0
git push -f origin v0.8.0
echo [5/5] Tag v0.8.0 pushed.

echo.
echo ============================================
echo   All done! GitHub Actions is now building
echo   the Windows installer (about 15-25 min).
echo.
echo   Build progress:
echo   https://github.com/wuyuanzhan43-cyber/task_planning/actions
echo.
echo   EXE download (after the build finishes):
echo   https://github.com/wuyuanzhan43-cyber/task_planning/releases/latest
echo ============================================
pause
