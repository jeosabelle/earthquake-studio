{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * ==========================================================================\
 * EARTHQUAKE DUBBING STUDIO - MASTER CORE CONTROLLER\
 * ==========================================================================\
 */\
\
// 1. EDITABLE LOCAL DIALOGUE DATABASE (Teachers can edit lines directly here)\
const DIALOGUE_SCRIPT = [\
    \{ start: 1.0, end: 4.5, speaker: "Teacher", text: "Attention class! Drop, Cover, and Hold On! Protect your heads!" \},\
    \{ start: 5.0, end: 8.0, speaker: "Student 1", text: "I'm under the desk! Is everyone safe?" \},\
    \{ start: 8.5, end: 11.5, speaker: "Student 2", text: "Yes, but it's shaking violently! Hold onto the table legs!" \},\
    \{ start: 12.0, end: 15.0, speaker: "Student 3", text: "Don't panic, stay away from the window glass!" \},\
    \{ start: 16.0, end: 20.0, speaker: "Teacher", text: "The shaking has stopped. Grab your bags, protect your heads, and exit to the courtyard safely." \}\
];\
\
// 2. STATE MANAGER VARIABLES\
let appConfig = \{\
    title: "", teacher: "", scriptUrl: "", folderId: "",\
    camPos: "top-right", camSize: "medium", safeMode: true\
\};\
let studentData = \{ classNum: "", groupNum: "", names: [] \};\
\
let localStreams = \{ inputMic: null, inputCam: null, combinedMedia: null \};\
let mediaRecorder = null;\
let compiledChunks = [];\
let trackingTimer = null;\
let recordingSeconds = 0;\
let canvasDrawLoop = null;\
let activeCameraId = null;\
let accessibleCameras = [];\
\
// DOM Reference Cache\
const dom = \{\
    screenTeacher: document.getElementById('screen-teacher'),\
    screenStudent: document.getElementById('screen-student'),\
    screenStudio: document.getElementById('screen-studio'),\
    btnSaveConfig: document.getElementById('btn-save-config'),\
    btnToStudentSetup: document.getElementById('btn-to-student-setup'),\
    btnStartStudio: document.getElementById('btn-start-studio'),\
    btnToggleCam: document.getElementById('btn-toggle-cam'),\
    btnFlipCam: document.getElementById('btn-flip-cam'),\
    btnStartRec: document.getElementById('btn-start-rec'),\
    btnPauseRec: document.getElementById('btn-pause-rec'),\
    btnStopRec: document.getElementById('btn-stop-rec'),\
    btnPlayAsset: document.getElementById('btn-play-asset'),\
    btnPauseAsset: document.getElementById('btn-pause-asset'),\
    btnRestartAsset: document.getElementById('btn-restart-asset'),\
    btnMuteAsset: document.getElementById('btn-mute-asset'),\
    btnPreviewPlayback: document.getElementById('btn-preview-playback'),\
    btnRecordAgain: document.getElementById('btn-record-again'),\
    btnBackupDownload: document.getElementById('btn-backup-download'),\
    hiddenVideo: document.getElementById('hidden-video'),\
    hiddenCamera: document.getElementById('hidden-camera'),\
    studioCanvas: document.getElementById('studio-canvas'),\
    scriptContainer: document.getElementById('script-container'),\
    recIndicator: document.getElementById('rec-indicator'),\
    recTimer: document.getElementById('rec-timer'),\
    countdownOverlay: document.getElementById('countdown-overlay'),\
    uploadPanel: document.getElementById('upload-panel'),\
    uploadProgress: document.getElementById('upload-progress'),\
    uploadPercentage: document.getElementById('upload-percentage'),\
    uploadStatusText: document.getElementById('upload-status-text'),\
    postRecordActions: document.getElementById('post-record-actions'),\
    hardwareStatus: document.getElementById('hardware-status'),\
    toast: document.getElementById('system-toast')\
\};\
\
const ctx = dom.studioCanvas.getContext('2d');\
\
// ==========================================\
// 3. INITIALIZATION & ROUTING EVENTS\
// ==========================================\
window.addEventListener('DOMContentLoaded', () => \{\
    initAppEvents();\
    renderClassDropdown();\
    buildScriptUI();\
\});\
\
function initAppEvents() \{\
    // Config Screen Action Handling\
    dom.btnSaveConfig.addEventListener('click', handleSaveConfiguration);\
    dom.btnToStudentSetup.addEventListener('click', () => switchScreen('student'));\
    \
    // Student Form Setup Handling\
    dom.btnStartStudio.addEventListener('click', handleStudentSetupSubmit);\
    \
    // Camera Stream Management\
    dom.btnToggleCam.addEventListener('click', toggleCameraSystem);\
    dom.btnFlipCam.addEventListener('click', flipCameraInput);\
    \
    // Hidden Master Video Controls\
    dom.btnPlayAsset.addEventListener('click', () => dom.hiddenVideo.play());\
    dom.btnPauseAsset.addEventListener('click', () => dom.hiddenVideo.pause());\
    dom.btnRestartAsset.addEventListener('click', () => \{ dom.hiddenVideo.currentTime = 0; dom.hiddenVideo.play(); \});\
    dom.btnMuteAsset.addEventListener('click', () => \{\
        dom.hiddenVideo.muted = !dom.hiddenVideo.muted;\
        dom.btnMuteAsset.innerText = dom.hiddenVideo.muted ? "\uc0\u55357 \u56583  Unmute" : "\u55357 \u56586  Mute Music";\
    \});\
    \
    // Dynamic Frame Subtitle / Highlights Synchronizer\
    dom.hiddenVideo.addEventListener('timeupdate', synchronizeStudioTimeline);\
    \
    // Recorder Management Handlers\
    dom.btnStartRec.addEventListener('click', preRecordCountdown);\
    dom.btnPauseRec.addEventListener('click', pauseRecordingStudio);\
    dom.btnStopRec.addEventListener('click', stopAndSaveStudioOutput);\
    \
    // Post Recording Local Handlers\
    dom.btnPreviewPlayback.addEventListener('click', previewFinalVideoBlob);\
    dom.btnRecordAgain.addEventListener('click', resetStudioForReRecording);\
    dom.btnBackupDownload.addEventListener('click', forceDownloadBackupBlob);\
    \
    // Video Resource Handling\
    document.getElementById('cfg-video-file').addEventListener('change', handleLocalVideoImport);\
\}\
\
function showToast(msg, type = 'info') \{\
    dom.toast.innerText = msg;\
    dom.toast.className = `toast $\{type\}`;\
    dom.toast.classList.remove('hidden');\
    setTimeout(() => dom.toast.classList.add('hidden'), 5000);\
\}\
\
function switchScreen(target) \{\
    dom.screenTeacher.classList.remove('active');\
    dom.screenStudent.classList.remove('active');\
    dom.screenStudio.classList.remove('active');\
    \
    if(target === 'teacher') dom.screenTeacher.classList.add('active');\
    if(target === 'student') dom.screenStudent.classList.add('active');\
    if(target === 'studio') dom.screenStudio.classList.add('active');\
\}\
\
// ==========================================\
// 4. TEACHER UTILS & UI GENERATION\
// ==========================================\
function renderClassDropdown() \{\
    const lines = document.getElementById('cfg-classes').value.split('\\n');\
    const select = document.getElementById('student-class');\
    select.innerHTML = '';\
    lines.forEach(line => \{\
        let clean = line.trim();\
        if(clean) \{\
            let opt = document.createElement('option');\
            opt.value = clean; opt.innerText = clean;\
            select.appendChild(opt);\
        \}\
    \});\
\}\
\
function buildScriptUI() \{\
    dom.scriptContainer.innerHTML = '';\
    DIALOGUE_SCRIPT.forEach((line, index) => \{\
        let div = document.createElement('div');\
        div.className = 'script-line';\
        div.id = `script-line-$\{index\}`;\
        div.innerHTML = `<div class="speaker-label">$\{line.speaker\}:</div><div class="line-text">"$\{line.text\}"</div>`;\
        dom.scriptContainer.appendChild(div);\
    \});\
\}\
\
function handleLocalVideoImport(e) \{\
    const file = e.target.files[0];\
    if(file) \{\
        dom.hiddenVideo.src = URL.createObjectURL(file);\
        dom.hiddenVideo.load();\
        showToast("Video Asset Imported Successfully.", "success");\
    \}\
\}\
\
function handleSaveConfiguration() \{\
    appConfig.title = document.getElementById('cfg-title').value.trim();\
    appConfig.teacher = document.getElementById('cfg-teacher').value.trim();\
    appConfig.scriptUrl = document.getElementById('cfg-script-url').value.trim();\
    appConfig.folderId = document.getElementById('cfg-folder-id').value.trim();\
    appConfig.camPos = document.getElementById('cfg-cam-pos').value;\
    appConfig.camSize = document.getElementById('cfg-cam-size').value;\
    appConfig.safeMode = document.getElementById('cfg-safe-mode').checked;\
    \
    if(!appConfig.scriptUrl || !appConfig.folderId) \{\
        showToast("Error: Google Apps Script URL & Folder ID are absolute requirements.", "error");\
        return;\
    \}\
    if(!dom.hiddenVideo.src) \{\
        showToast("Warning: Please upload a dialogue master reference video.", "error");\
        return;\
    \}\
    \
    document.getElementById('display-activity-title').innerText = `\uc0\u55356 \u57260  $\{appConfig.title\}`;\
    renderClassDropdown();\
    dom.btnToStudentSetup.removeAttribute('disabled');\
    showToast("Configuration Applied Successfully.", "success");\
\}\
\
// ==========================================\
// 5. STUDENT CORE SETUP INTERACTION\
// ==========================================\
function handleStudentSetupSubmit() \{\
    studentData.classNum = document.getElementById('student-class').value;\
    studentData.groupNum = document.getElementById('student-group').value.trim() || "GroupX";\
    \
    studentData.names = [];\
    for(let i=1; i<=5; i++) \{\
        let val = document.getElementById(`student-name-$\{i\}`).value.trim();\
        if(val) studentData.names.push(val);\
    \}\
    \
    if(studentData.names.length === 0) \{\
        showToast("At least one student name entry is mandatory.", "error");\
        return;\
    \}\
    \
    document.getElementById('group-tag-display').innerText = `$\{studentData.classNum\} - $\{studentData.groupNum\}`;\
    switchScreen('studio');\
    initiateCanvasCompositorEngine();\
\}\
\
// ==========================================\
// 6. HARDWARE SYSTEMS (AUDIO/VIDEO)\
// ==========================================\
async function toggleCameraSystem() \{\
    if(localStreams.inputCam) \{\
        // Disconnect Camera Track Routine\
        localStreams.inputCam.getTracks().forEach(track => track.stop());\
        localStreams.inputCam = null;\
        dom.hiddenCamera.srcObject = null;\
        dom.btnToggleCam.innerText = "Start Camera";\
        dom.btnFlipCam.setAttribute('disabled', 'true');\
        updateHardwareStatusLabel();\
    \} else \{\
        try \{\
            // Request both Camera and Microphone input up front to prevent multi-prompt pipeline lags on Safari\
            let constraints = \{ video: \{ width: 640, height: 480, facingMode: "user" \}, audio: true \};\
            let rawStream = await navigator.mediaDevices.getUserMedia(constraints);\
            \
            // Extract the microphone line specifically\
            let micAudioTracks = rawStream.getAudioTracks();\
            if(micAudioTracks.length > 0) \{\
                localStreams.inputMic = new MediaStream([micAudioTracks[0]]);\
            \}\
            \
            // Extract the webcam line specifically\
            let cameraTracks = rawStream.getVideoTracks();\
            if(cameraTracks.length > 0) \{\
                localStreams.inputCam = new MediaStream([cameraTracks[0]]);\
                dom.hiddenCamera.srcObject = localStreams.inputCam;\
                dom.hiddenCamera.play().catch(e => console.log("Camera play defer stalled", e));\
            \}\
            \
            dom.btnToggleCam.innerText = "Turn Camera Off";\
            dom.btnStartRec.removeAttribute('disabled');\
            updateHardwareStatusLabel();\
            \
            // Fetch connected endpoints to evaluate layout changes (flipping back/front)\
            enumerateVideoDevices();\
        \} catch(err) \{\
            console.error(err);\
            showToast("Permissions Denied: Verify access locks on Microphone/Camera profiles.", "error");\
        \}\
    \}\
\}\
\
async function enumerateVideoDevices() \{\
    try \{\
        let devices = await navigator.mediaDevices.enumerateDevices();\
        accessibleCameras = devices.filter(d => d.kind === 'videoinput');\
        if(accessibleCameras.length > 1) \{\
            dom.btnFlipCam.removeAttribute('disabled');\
        \}\
    \} catch(e) \{ console.warn("Could not index system camera items", e); \}\
\}\
\
async function flipCameraInput() \{\
    if(!localStreams.inputCam || accessibleCameras.length < 2) return;\
    let currentTrack = localStreams.inputCam.getVideoTracks()[0];\
    let settings = currentTrack.getSettings();\
    let currentFacing = settings.facingMode;\
    \
    let targetFacing = (currentFacing === "user") ? "environment" : "user";\
    \
    currentTrack.stop();\
    try \{\
        let freshStream = await navigator.mediaDevices.getUserMedia(\{\
            video: \{ width: 640, height: 480, facingMode: targetFacing \}\
        \});\
        localStreams.inputCam = freshStream;\
        dom.hiddenCamera.srcObject = freshStream;\
        dom.hiddenCamera.play();\
    \} catch(err) \{\
        showToast("Error toggling camera alignment.", "error");\
    \}\
\}\
\
function updateHardwareStatusLabel() \{\
    let status = [];\
    status.push(localStreams.inputMic ? "Mic: ON" : "Mic: OFF");\
    status.push(localStreams.inputCam ? "Cam: ON" : "Cam: OFF");\
    dom.hardwareStatus.innerText = status.join(" | ");\
\}\
\
// ==========================================\
// 7. COMPOSITING REALTIME CANVAS ENGINE\
// ==========================================\
function initiateCanvasCompositorEngine() \{\
    if(canvasDrawLoop) cancelAnimationFrame(canvasDrawLoop);\
    \
    function updateFrameLoop() \{\
        // Base backing rendering clearing pass\
        ctx.fillStyle = "#000000";\
        ctx.fillRect(0, 0, dom.studioCanvas.width, dom.studioCanvas.height);\
        \
        // Layer 1: Master Video Backdrop\
        if(dom.hiddenVideo && !dom.hiddenVideo.paused && !dom.hiddenVideo.ended || dom.hiddenVideo.currentTime > 0) \{\
            ctx.drawImage(dom.hiddenVideo, 0, 0, dom.studioCanvas.width, dom.studioCanvas.height);\
        \} else \{\
            // Placeholder text when idle\
            ctx.fillStyle = "#ffffff";\
            ctx.font = "24px sans-serif";\
            ctx.textAlign = "center";\
            ctx.fillText("Studio Video Ready", dom.studioCanvas.width/2, dom.studioCanvas.height/2 - 20);\
        \}\
        \
        // Layer 2: Live Picture-in-Picture Camera Overlays\
        if(localStreams.inputCam && dom.hiddenCamera.readyState >= 2) \{\
            renderEmbeddedCameraOverlay();\
        \}\
        \
        // Layer 3: Mirror burned hard-coded subtitles natively into composite tracking stream\
        renderSubtitlesDirectlyToCanvas();\
        \
        canvasDrawLoop = requestAnimationFrame(updateFrameLoop);\
    \}\
    canvasDrawLoop = requestAnimationFrame(updateFrameLoop);\
\}\
\
function renderEmbeddedCameraOverlay() \{\
    let sizeDim = 180; // Default Medium Fallback\
    if(appConfig.camSize === 'small') sizeDim = 120;\
    if(appConfig.camSize === 'large') sizeDim = 240;\
    \
    let aspect = 4 / 3;\
    let w = sizeDim * aspect;\
    let h = sizeDim;\
    \
    let padding = 15;\
    let x = dom.studioCanvas.width - w - padding;\
    let y = padding; // Default top-right logic\
    \
    // Evaluate operational placement configurations\
    if(appConfig.camPos === 'top-left') \{ x = padding; y = padding; \}\
    if(appConfig.camPos === 'bottom-left') \{ x = padding; y = dom.studioCanvas.height - h - padding; \}\
    if(appConfig.camPos === 'bottom-right') \{ x = dom.studioCanvas.width - w - padding; y = dom.studioCanvas.height - h - padding; \}\
    \
    // Subtitle Safe Mode overrides: Shift overlays upward if a collision occurs on lower panels\
    if(appConfig.safeMode && (appConfig.camPos === 'bottom-left' || appConfig.camPos === 'bottom-right')) \{\
        let activeSub = getCurrentSubtitle();\
        if(activeSub) \{\
            y -= 50; // Dynamically push upward away from text rendering bands\
        \}\
    \}\
    \
    // Draw Picture Frame Container Box\
    ctx.lineWidth = 4;\
    ctx.strokeStyle = "#0070f3";\
    ctx.fillStyle = "#111";\
    ctx.fillRect(x, y, w, h);\
    \
    // Capture and map live camera inputs\
    ctx.save();\
    // Mirror front-facing standard feeds for high usability\
    ctx.translate(x + w, y);\
    ctx.scale(-1, 1);\
    ctx.drawImage(dom.hiddenCamera, 0, 0, w, h);\
    ctx.restore();\
    ctx.strokeRect(x, y, w, h);\
\}\
\
function renderSubtitlesDirectlyToCanvas() \{\
    let currentLine = getCurrentSubtitle();\
    if(!currentLine) return;\
    \
    ctx.save();\
    ctx.font = "bold 24px sans-serif";\
    ctx.textAlign = "center";\
    ctx.textBaseline = "bottom";\
    \
    let x = dom.studioCanvas.width / 2;\
    let y = dom.studioCanvas.height - 30;\
    \
    // Generate text backdrop contrast box\
    ctx.font = "bold 24px sans-serif";\
    let textMetrics = ctx.measureText(currentLine.text);\
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";\
    ctx.fillRect(x - textMetrics.width/2 - 15, y - 32, textMetrics.width + 30, 40);\
    \
    // Text Render Core\
    ctx.fillStyle = "#ffffff";\
    ctx.fillText(currentLine.text, x, y);\
    ctx.restore();\
\}\
\
function getCurrentSubtitle() \{\
    let t = dom.hiddenVideo.currentTime;\
    return DIALOGUE_SCRIPT.find(line => t >= line.start && t <= line.end);\
\}\
\
function synchronizeStudioTimeline() \{\
    let t = dom.hiddenVideo.currentTime;\
    DIALOGUE_SCRIPT.forEach((line, index) => \{\
        let el = document.getElementById(`script-line-$\{index\}`);\
        if(t >= line.start && t <= line.end) \{\
            if(!el.classList.contains('active')) \{\
                el.classList.add('active');\
                el.scrollIntoView(\{ behavior: 'smooth', block: 'nearest' \});\
            \}\
        \} else \{\
            el.classList.remove('active');\
        \}\
    \});\
\}\
\
// ==========================================\
// 8. RECORDING CONTROLLER PIPELINE\
// ==========================================\
function preRecordCountdown() \{\
    dom.btnStartRec.setAttribute('disabled', 'true');\
    dom.countdownOverlay.classList.remove('hidden');\
    let count = 3;\
    dom.countdownOverlay.innerText = count;\
    \
    let timer = setInterval(() => \{\
        count--;\
        if(count <= 0) \{\
            clearInterval(timer);\
            dom.countdownOverlay.classList.add('hidden');\
            executeStartRecordingStudio();\
        \} else \{\
            dom.countdownOverlay.innerText = count;\
        \}\
    \}, 1000);\
\}\
\
function executeStartRecordingStudio() \{\
    compiledChunks = [];\
    \
    // Capture standard video tracks at 30 FPS from the Canvas Engine \
    let canvasCompositeStream = dom.studioCanvas.captureStream(30);\
    let outputTracks = [];\
    \
    canvasCompositeStream.getVideoTracks().forEach(t => outputTracks.push(t));\
    \
    // Verify audio track dependencies, ensuring mic captures mix in seamlessly\
    if(localStreams.inputMic && localStreams.inputMic.getAudioTracks().length > 0) \{\
        outputTracks.push(localStreams.inputMic.getAudioTracks()[0]);\
    \} else \{\
        showToast("Recording warning: No Microphone audio line connected.", "error");\
    \}\
    \
    // Bind tracks together into a single pipeline output stream\
    localStreams.combinedMedia = new MediaStream(outputTracks);\
    \
    // MediaRecorder standard formats fallbacks implementation (Safari / Chrome Cross-compatibility)\
    let formatOptions = \{ mimeType: 'video/webm;codecs=vp8' \};\
    if (!MediaRecorder.isTypeSupported(formatOptions.mimeType)) \{\
        formatOptions = \{ mimeType: 'video/mp4' \}; // Fallback strategy for legacy platforms\
    \}\
    \
    try \{\
        mediaRecorder = new MediaRecorder(localStreams.combinedMedia, formatOptions);\
    \} catch (e) \{\
        mediaRecorder = new MediaRecorder(localStreams.combinedMedia); // Ultimate dynamic fallback mapping\
    \}\
    \
    mediaRecorder.ondataavailable = (e) => \{\
        if(e.data && e.data.size > 0) compiledChunks.push(e.data);\
    \};\
    \
    mediaRecorder.onstop = compileAndProcessRecordingBlob;\
    \
    // Reset structural layout timers\
    recordingSeconds = 0;\
    dom.recTimer.innerText = "00:00";\
    dom.recIndicator.classList.remove('hidden');\
    \
    // Start Recording Core\
    mediaRecorder.start(250); // Slice dynamic increments into chunk targets\
    \
    trackingTimer = setInterval(() => \{\
        recordingSeconds++;\
        let m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');\
        let s = String(recordingSeconds % 60).padStart(2, '0');\
        dom.recTimer.innerText = `$\{m\}:$\{s\}`;\
    \}, 1000);\
    \
    // Sync backing track parameters and start playback\
    dom.hiddenVideo.currentTime = 0;\
    dom.hiddenVideo.play();\
    \
    dom.btnPauseRec.removeAttribute('disabled');\
    dom.btnStopRec.removeAttribute('disabled');\
    dom.postRecordActions.classList.add('hidden');\
\}\
\
function pauseRecordingStudio() \{\
    if(!mediaRecorder || mediaRecorder.state === 'inactive') return;\
    \
    if(mediaRecorder.state === 'recording') \{\
        mediaRecorder.pause();\
        dom.hiddenVideo.pause();\
        clearInterval(trackingTimer);\
        dom.btnPauseRec.innerText = "\uc0\u9654  Resume Rec";\
    \} else if(mediaRecorder.state === 'paused') \{\
        mediaRecorder.resume();\
        dom.hiddenVideo.play();\
        trackingTimer = setInterval(() => \{\
            recordingSeconds++;\
            let m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');\
            let s = String(recordingSeconds % 60).padStart(2, '0');\
            dom.recTimer.innerText = `$\{m\}:$\{s\}`;\
        \}, 1000);\
        dom.btnPauseRec.innerText = "\uc0\u9208  Pause Rec";\
    \}\
\}\
\
function stopAndSaveStudioOutput() \{\
    if(!mediaRecorder || mediaRecorder.state === 'inactive') return;\
    \
    dom.recIndicator.classList.add('hidden');\
    clearInterval(trackingTimer);\
    dom.hiddenVideo.pause();\
    \
    mediaRecorder.stop(); // Triggers compileAndProcessRecordingBlob\
    \
    dom.btnPauseRec.setAttribute('disabled', 'true');\
    dom.btnStopRec.setAttribute('disabled', 'true');\
\}\
\
let generatedFinalBlob = null;\
\
function compileAndProcessRecordingBlob() \{\
    generatedFinalBlob = new Blob(compiledChunks, \{ type: mediaRecorder.mimeType \});\
    showToast("Processing complete. Video compiled successfully.", "success");\
    \
    dom.postRecordActions.classList.remove('hidden');\
    dom.btnStartRec.removeAttribute('disabled');\
    \
    // Immediately execute autonomous background remote Drive syncing pipelines\
    dispatchVideoToGoogleCloud();\
\}\
\
function previewFinalVideoBlob() \{\
    if(!generatedFinalBlob) return;\
    const testUrl = URL.createObjectURL(generatedFinalBlob);\
    \
    // Disconnect frame synchronization systems during review states\
    dom.hiddenVideo.removeEventListener('timeupdate', synchronizeStudioTimeline);\
    \
    dom.hiddenVideo.src = testUrl;\
    dom.hiddenVideo.controls = true;\
    dom.hiddenVideo.load();\
    dom.hiddenVideo.play();\
    \
    showToast("Review mode: Tap Reset or Record Again to exit playback mode.", "info");\
\}\
\
function resetStudioForReRecording() \{\
    dom.hiddenVideo.controls = false;\
    dom.hiddenVideo.src = "";\
    \
    // Rebind frame handlers\
    dom.hiddenVideo.addEventListener('timeupdate', synchronizeStudioTimeline);\
    \
    // Clear video paths\
    const file = document.getElementById('cfg-video-file').files[0];\
    if(file) \{\
        dom.hiddenVideo.src = URL.createObjectURL(file);\
    \}\
    dom.hiddenVideo.load();\
    \
    dom.postRecordActions.classList.add('hidden');\
    dom.uploadPanel.classList.add('hidden');\
    showToast("Studio Reset: Ready for new session recording.", "info");\
\}\
\
function forceDownloadBackupBlob() \{\
    if(!generatedFinalBlob) return;\
    const a = document.createElement('a');\
    a.href = URL.createObjectURL(generatedFinalBlob);\
    a.download = generateStrictStandardFilename();\
    a.click();\
\}\
\
function generateStrictStandardFilename() \{\
    let namesJoint = studentData.names.join("_");\
    let now = new Date();\
    let dateStr = now.toISOString().split('T')[0];\
    \
    let hours = now.getHours();\
    let minutes = String(now.getMinutes()).padStart(2, '0');\
    let ampm = hours >= 12 ? 'PM' : 'AM';\
    hours = hours % 12;\
    hours = hours ? hours : 12; // Handle midnight evaluation bounds\
    let timeStr = `$\{hours\}$\{minutes\}$\{ampm\}`;\
    \
    // Format: 801_Group3_Andy_Mary_Kevin_2026-05-25_1015AM.webm\
    let ext = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';\
    return `$\{studentData.classNum\}_$\{studentData.groupNum\}_$\{namesJoint\}_$\{dateStr\}_$\{timeStr\}.$\{ext\}`;\
\}\
\
// ==========================================\
// 9. GOOGLE APPS SCRIPT CLOUD CONNECT BACKEND\
// ==========================================\
function dispatchVideoToGoogleCloud() \{\
    if(!generatedFinalBlob) return;\
    \
    dom.uploadPanel.classList.remove('hidden');\
    dom.uploadProgress.style.width = "10%";\
    dom.uploadPercentage.innerText = "10%";\
    dom.uploadStatusText.innerText = "Uploading to Teacher's Google Drive...";\
    \
    let reader = new FileReader();\
    reader.readAsDataURL(generatedFinalBlob);\
    reader.onloadend = function() \{\
        let base64Data = reader.result.split(',')[1];\
        \
        let payload = \{\
            classNum: studentData.classNum,\
            groupNum: studentData.groupNum,\
            studentNames: studentData.names.join(", "),\
            filename: generateStrictStandardFilename(),\
            folderId: appConfig.folderId,\
            videoBlobData: base64Data\
        \};\
        \
        dom.uploadProgress.style.width = "40%";\
        dom.uploadPercentage.innerText = "40%";\
        \
        // Execute Cross-Origin Resource Request directly to deployed GAS endpoint\
        fetch(appConfig.scriptUrl, \{\
            method: 'POST',\
            mode: 'cors',\
            headers: \{ 'Content-Type': 'text/plain;charset=utf-8' \},\
            body: JSON.stringify(payload)\
        \})\
        .then(res => \{\
            if(!res.ok) throw new Error("HTTP Network connection fault.");\
            return res.json();\
        \})\
        .then(data => \{\
            if(data.success) \{\
                dom.uploadProgress.style.width = "100%";\
                dom.uploadPercentage.innerText = "100%";\
                dom.uploadStatusText.innerText = "\uc0\u9989  Upload Successful!";\
                showToast("Submission successfully synchronized to cloud storage.", "success");\
            \} else \{\
                throw new Error(data.message || "Drive writing failure.");\
            \}\
        \})\
        .catch(err => \{\
            console.error(err);\
            dom.uploadStatusText.innerText = "\uc0\u10060  Upload Failed!";\
            dom.uploadProgress.style.width = "0%";\
            dom.uploadPercentage.innerText = "Error";\
            showToast(`Cloud Sync Failure. Use 'Download Backup Copy' to save your work manually!`, "error");\
        \});\
    \};\
\}}
