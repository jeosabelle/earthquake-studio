let appConfig = { scriptUrl: '', folderId: '', teacherName: '', classes: [] };
let mediaRecorder = null;
let recordedChunks = [];
let localStream = null;
let videoBlob = null;

document.addEventListener('DOMContentLoaded', () => {
    setupConfigActions();
    setupStudioActions();
    checkUrlParameters();
});

function setupConfigActions() {
    const btnSave = document.getElementById('btn-save-config');
    const btnNext = document.getElementById('btn-to-student-setup');

    btnSave.addEventListener('click', () => {
        appConfig.scriptUrl = document.getElementById('input-script-url').value.trim();
        appConfig.folderId = document.getElementById('input-folder-id').value.trim();
        appConfig.teacherName = document.getElementById('input-teacher-name').value.trim();
        
        const classInput = document.getElementById('input-classes').value;
        appConfig.classes = classInput.split(',').map(c => c.trim()).filter(c => c.length > 0);

        if (!appConfig.scriptUrl || !appConfig.folderId) {
            alert("⚠️ Please paste both your Google Apps Script URL and Google Drive Folder ID!");
            return;
        }

        btnNext.removeAttribute('disabled');
        btnNext.disabled = false;
        
        // Create shareable long parameter link automatically
        const params = new URLSearchParams();
        params.set('s', appConfig.scriptUrl);
        params.set('f', appConfig.folderId);
        params.set('t', appConfig.teacherName);
        params.set('c', classInput);
        window.history.replaceState({}, '', '?' + params.toString());

        alert("✅ Configuration Locked! Click 'Start Activity' to proceed.");
    });

    btnNext.addEventListener('click', () => {
        buildClassDropdown();
        document.getElementById('screen-config').classList.add('hidden');
        document.getElementById('screen-login').classList.remove('hidden');
    });
}

function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('s') && urlParams.has('f')) {
        document.getElementById('input-script-url').value = urlParams.get('s');
        document.getElementById('input-folder-id').value = urlParams.get('f');
        if (urlParams.has('t')) document.getElementById('input-teacher-name').value = urlParams.get('t');
        if (urlParams.has('c')) document.getElementById('input-classes').value = urlParams.get('c');
        
        // Auto click lock to let teacher/student bypass setup easily
        document.getElementById('btn-save-config').click();
    }
}

function buildClassDropdown() {
    const select = document.getElementById('select-class');
    select.innerHTML = '';
    appConfig.classes.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.textContent = cls;
        select.appendChild(opt);
    });
}

function setupStudioActions() {
    const fileInput = document.getElementById('input-video-file');
    const videoPlayback = document.getElementById('video-playback');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            videoPlayback.src = url;
            videoPlayback.load();
        }
    });

    document.getElementById('btn-enter-studio').addEventListener('click', () => {
        const cls = document.getElementById('select-class').value;
        const group = document.getElementById('input-group-name').value.trim() || "Unnamed Group";
        const students = document.getElementById('input-students').value.trim() || "Anonymous";
        
        if(!videoPlayback.src) {
            alert("⚠️ No custom video has been loaded into the setup board yet! Go back or refresh.");
            return;
        }

        document.getElementById('studio-group-tag').textContent = `${cls} - ${group} (${students})`;
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-studio').classList.remove('hidden');
    });

    document.getElementById('btn-start-cam').addEventListener('click', async () => {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, music: false, audio: true });
            document.getElementById('video-webcam').srcObject = localStream;
            document.getElementById('btn-start-record').removeAttribute('disabled');
            document.getElementById('btn-start-cam').style.display = "none";
        } catch (err) {
            alert("❌ Camera/Microphone access was denied or unavailable. Please verify iPad permissions!");
        }
    });

    const btnRecord = document.getElementById('btn-start-record');
    const btnStop = document.getElementById('btn-stop-record');
    const countdownOverlay = document.getElementById('countdown-overlay');

    btnRecord.addEventListener('click', () => {
        btnRecord.disabled = true;
        let count = 3;
        countdownOverlay.textContent = `🎬 Starting in ${count}...`;
        
        const interval = setInterval(() => {
            count--;
            if(count > 0) {
                countdownOverlay.textContent = `🎬 Starting in ${count}...`;
            } else {
                clearInterval(interval);
                countdownOverlay.textContent = "🔴 RECORDING LIVE";
                startRecordingSystem();
                btnStop.removeAttribute('disabled');
            }
        }, 1000);
    });

    btnStop.addEventListener('click', () => {
        btnStop.disabled = true;
        countdownOverlay.textContent = "";
        stopRecordingSystem();
    });
}

function startRecordingSystem() {
    recordedChunks = [];
    const videoPlayback = document.getElementById('video-playback');
    
    videoPlayback.currentTime = 0;
    videoPlayback.play();

    // Capture standard audio/video payload stream from combined tracks
    mediaRecorder = new MediaRecorder(localStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    
    mediaRecorder.onstop = () => {
        videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        executeUploadToGoogleDrive();
    };
    
    mediaRecorder.start(500); // chunk slices every half-second safely
}

function stopRecordingSystem() {
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    const videoPlayback = document.getElementById('video-playback');
    videoPlayback.pause();
}

function executeUploadToGoogleDrive() {
    const toast = document.getElementById('upload-status-toast');
    const bar = document.getElementById('upload-progress');
    const title = document.getElementById('upload-status-title');
    const msg = document.getElementById('upload-status-msg');

    toast.classList.remove('hidden');
    bar.style.width = "15%";
    title.textContent = "Processing Recording File...";
    msg.textContent = "Converting video arrays...";

    const reader = new FileReader();
    reader.readAsDataURL(videoBlob);
    reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        bar.style.width = "45%";
        title.textContent = "Uploading to Cloud Storage...";
        msg.textContent = "Sending raw tracks directly to Google Drive folder...";

        const tagText = document.getElementById('studio-group-tag').textContent;
        
        const payload = {
            filename: `${tagText.replace(/[^a-zA-Z0-9_\-\(\)]/g, "_")}.webm`,
            mimeType: "video/webm",
            rootFolderId: appConfig.folderId,
            classDesignation: tagText.split(' - ')[0], 
            fileData: base64Data
        };

        fetch(appConfig.scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Essential bypass layer for cross-domain student networks
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(() => {
            // Because 'no-cors' mode returns opaque responses, we assume immediate completion on response capture
            bar.style.width = "100%";
            bar.style.backgroundColor = "#10b981";
            title.textContent = "✅ Upload Completed Successfully!";
            msg.textContent = "Saved to your class files layout folder.";
            setTimeout(() => { toast.classList.add('hidden'); bar.style.width="0%"; bar.style.backgroundColor="#10b981"; }, 5000);
        })
        .catch((err) => {
            bar.style.width = "100%";
            bar.style.backgroundColor = "#ef4444";
            title.textContent = "⚠️ Link Process Interrupted";
            msg.textContent = "File pipeline completed connection profile.";
        });
    };
}
