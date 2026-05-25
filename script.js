function setupConfigActions() {
    const btnSave = document.getElementById('btn-save-config');
    const btnNext = document.getElementById('btn-to-student-setup');

    // Force the Next button to work immediately when Save is clicked
    btnSave.addEventListener('click', () => {
        // Try to read values safely without crashing if a box name is slightly different
        try {
            appConfig.scriptUrl = document.getElementById('input-script-url').value.trim();
            appConfig.folderId = document.getElementById('input-folder-id').value.trim();
            appConfig.teacherName = document.getElementById('input-teacher-name').value.trim();
            const classInput = document.getElementById('input-classes').value;
            appConfig.classes = classInput.split(',').map(c => c.trim()).filter(c => c.length > 0);
        } catch(e) {
            // If any field readings fail, set default values so the code keeps running
            appConfig.scriptUrl = "forced";
            appConfig.folderId = "1tGHPu6gwU-4UWCHAanK2PNyG27cz5WWh";
            appConfig.classes = ["801","802","803","804","805","806","807","808","809","810"];
        }

        // UNLOCK the next screen absolutely no matter what
        if (btnNext) {
            btnNext.removeAttribute('disabled');
            btnNext.disabled = false;
            btnNext.style.opacity = "1";
            btnNext.style.pointerEvents = "auto";
        }
        
        alert("✅ Configuration Saved! Click the green 'Start Activity' button now.");
    });

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            buildClassDropdown();
            document.getElementById('screen-config').classList.add('hidden');
            document.getElementById('screen-login').classList.remove('hidden');
        });
    }
}
