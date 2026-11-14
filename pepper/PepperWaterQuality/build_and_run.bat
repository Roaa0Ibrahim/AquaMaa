@echo off
REM ============================================================
REM  Build the app, install it on Pepper's tablet and start it.
REM  1) PEPPER_IP = the lab robot's tablet "Run/Debug Config" IP
REM     APP_ID   = must match applicationId in app\build.gradle.kts
REM  2) Turn ADB ON on the tablet, then double-click this file
REM  3) Read build_log.txt for the result
REM ============================================================
set PEPPER_IP=192.168.8.101
set APP_ID=com.example.pepperwater

cd /d "%~dp0"
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist local.properties echo sdk.dir=%LOCALAPPDATA:\=\\%\\Android\\Sdk> local.properties
REM Java 17 first: Gradle 8.13 can't run on the Java 25 that new Android Studio versions bring (14 Nov)
if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot" set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
if not defined JAVA_HOME if exist "C:\Program Files\Android\Android Studio\jbr" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
(
echo JAVA_HOME=%JAVA_HOME%
"%ADB%" connect %PEPPER_IP%:5555
call gradlew.bat assembleDebug --console=plain || (echo BUILD FAILED & goto :eof)
echo --- install ---
"%ADB%" -s %PEPPER_IP%:5555 install -r app\build\outputs\apk\debug\app-debug.apk
echo --- launch ---
"%ADB%" -s %PEPPER_IP%:5555 shell am start -n %APP_ID%/com.example.pepperwater.MainActivity
echo === DONE ===
) > build_log.txt 2>&1
type build_log.txt
pause
