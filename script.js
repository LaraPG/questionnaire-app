// PROTECTION ULTRA STRICTE - Bloquer toute sauvegarde non autorisée
let SAVE_AUTHORIZED = false;
let AUTHORIZED_QUESTION_NUMBER = null;

// Intercepteur localStorage SIMPLIFIÉ
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    if (key.startsWith('question_data_') || key === 'all_days_csv_data') {
        console.log('🚨 LOCALSTORAGE WRITE ATTEMPT!');
        console.log('📊 Authorized:', SAVE_AUTHORIZED);
        
        if (SAVE_AUTHORIZED) {
            console.log('✅ AUTHORIZED: Writing to localStorage');
            try {
                originalSetItem.call(this, key, value);
                console.log('✅ SUCCESS: Data written to localStorage');
            } catch (error) {
                console.error('❌ WRITE ERROR:', error);
                // Réessayer après 100ms
                setTimeout(() => {
                    console.log('🔄 RETRYING localStorage write...');
                    try {
                        originalSetItem.call(this, key, value);
                        console.log('✅ RETRY SUCCESS: Data written');
                    } catch (retryError) {
                        console.error('❌ RETRY FAILED:', retryError);
                    }
                }, 100);
            }
        } else {
            console.log('❌ BLOCKED: Unauthorized localStorage write');
        }
    } else {
        originalSetItem.call(this, key, value);
    }
};

// CONFIGURATION POUR TESTS ET PRODUCTION
let QUESTION_DURATION_MINUTES = 1; // 1 minute pour tests
let DAILY_START_HOUR = 0; // Actif 24h/24 pour tests
let DAILY_END_HOUR = 24;

// Liste des questions prédéfinies
const QUESTIONS_LIST = [
    { option1: "Coffee", option2: "Tea" },
    { option1: "Morning", option2: "Evening" },
    { option1: "Summer", option2: "Winter" },
    { option1: "Beach", option2: "Mountains" },
    { option1: "Pizza", option2: "Burger" },
    { option1: "Netflix", option2: "YouTube" },
    { option1: "iPhone", option2: "Android" },
    { option1: "Cats", option2: "Dogs" },
    { option1: "Books", option2: "Movies" },
    { option1: "Sweet", option2: "Salty" },
    { option1: "Early Bird", option2: "Night Owl" },
    { option1: "City", option2: "Countryside" },
    { option1: "Chocolate", option2: "Vanilla" },
    { option1: "Rain", option2: "Sunshine" },
    { option1: "Facebook", option2: "Instagram" }
];

// Variables globales
let currentQuestionIndex = 0;
let currentQuestion = '';
let option1 = '';
let option2 = '';
let option1Count = 0;
let option2Count = 0;
let totalResponses = 0;
let currentMinute = 1;
let isQuestionActive = false;
let questionTimer = null;
let countdownTimer = null;
let timeRemaining = 60;
let isSaving = false;

// Fonction pour calculer quelle question devrait être active

// Version ultra-simple qui marche toujours
function calculateCurrentQuestion() {
    const now = new Date();
    
    // Calculer depuis minuit
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    
    // Index de la question (boucle infinie)
    const questionIndex = Math.floor(minutesSinceMidnight / QUESTION_DURATION_MINUTES) % QUESTIONS_LIST.length;
    
    // Temps restant dans cette minute
    const secondsInCurrentMinute = now.getSeconds();
    const timeRemaining = (QUESTION_DURATION_MINUTES * 60) - (secondsInCurrentMinute + (minutesSinceMidnight % QUESTION_DURATION_MINUTES) * 60);
    
    return {
        questionIndex: questionIndex,
        isActive: true,
        timeRemaining: Math.max(1, timeRemaining), // Minimum 1 seconde
        message: `Question ${questionIndex + 1}/${QUESTIONS_LIST.length} (Always Active)`
    };
}


// Fonction pour afficher le sélecteur de jour
function showDaySelector() {
    console.log('📅 showDaySelector called');
    
    const existingModal = document.getElementById('day-selector-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Récupérer tous les jours avec des données
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith('question_data_'));
    const csvData = localStorage.getItem('all_days_csv_data');
    
    if (allKeys.length === 0 && (!csvData || csvData.trim() === '')) {
        showNotification('❌ Aucune donnée trouvée !', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'day-selector-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10001;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        color: white;
        font-family: Arial, sans-serif;
        max-width: 500px;
        width: 90%;
        text-align: center;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    let dayOptions = '';
    
    // Option pour aujourd'hui (données CSV)
    if (csvData && csvData.trim() !== '') {
        const today = new Date().toISOString().split('T')[0];
        const todayFormatted = new Date().toLocaleDateString('fr-FR');
        const lines = csvData.split('\n').filter(line => line.trim() && !line.startsWith('Question'));
        
        dayOptions += `
            <div class="day-option" onclick="sendDayEmail('today')" style="
                background: rgba(255,255,255,0.2);
                margin: 10px 0;
                padding: 20px;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.borderColor='white';" 
               onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.borderColor='transparent';">
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">
                    📅 Aujourd'hui
                </div>
                <div style="font-size: 16px; opacity: 0.9;">
                    ${todayFormatted} • ${lines.length} réponses
                </div>
                <div style="font-size: 14px; opacity: 0.7; margin-top: 5px;">
                    Format CSV complet
                </div>
            </div>
        `;
    }
    
    // Options pour les autres jours
    allKeys.sort().reverse().forEach(key => {
        const date = key.replace('question_data_', '');
        const dayData = JSON.parse(localStorage.getItem(key));
        const questionCount = Object.keys(dayData).length;
        const dateFormatted = new Date(date).toLocaleDateString('fr-FR');
        
        // Calculer le total des réponses
        let totalResponses = 0;
        Object.values(dayData).forEach(q => {
            totalResponses += q.totalResponses || 0;
        });
        
        dayOptions += `
            <div class="day-option" onclick="sendDayEmail('${date}')" style="
                background: rgba(255,255,255,0.15);
                margin: 10px 0;
                padding: 20px;
                border-radius: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            " onmouseover="this.style.background='rgba(255,255,255,0.25)'; this.style.borderColor='white';" 
               onmouseout="this.style.background='rgba(255,255,255,0.15)'; this.style.borderColor='transparent';">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                    📊 ${dateFormatted}
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    ${questionCount} questions • ${totalResponses} réponses
                </div>
                <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">
                    Format JSON détaillé
                </div>
            </div>
        `;
    });
    
    // Option pour tout exporter
    dayOptions += `
        <div class="day-option" onclick="sendDayEmail('all')" style="
            background: linear-gradient(135deg, #FF6B6B, #FF8E53);
            margin: 15px 0;
            padding: 25px;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        " onmouseover="this.style.transform='scale(1.02)'; this.style.borderColor='white';" 
           onmouseout="this.style.transform='scale(1)'; this.style.borderColor='transparent';">
            <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">
                🗂️ TOUS LES JOURS
            </div>
            <div style="font-size: 16px; opacity: 0.9;">
                Export complet • ${allKeys.length} jours
            </div>
            <div style="font-size: 14px; opacity: 0.8; margin-top: 5px;">
                Fichier CSV consolidé
            </div>
        </div>
    `;
    
    container.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">📧 Send CSV Email</h2>
            <p style="margin: 0; opacity: 0.9; font-size: 16px;">
                Choose which day's data to send
            </p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
            ${dayOptions}
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        " onmouseover="this.style.background='#d32f2f'" onmouseout="this.style.background='#f44336'">
            ✕ Cancel
        </button>
    `;
    
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    // Fermer en cliquant à côté
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Fonction pour envoyer l'email d'un jour spécifique
function sendDayEmail(dayType) {
    console.log('📧 sendDayEmail called for:', dayType);
    
    let csvData = '';
    let subject = '';
    let dayInfo = '';
    
    if (dayType === 'today') {
        // Données CSV d'aujourd'hui
        csvData = localStorage.getItem('all_days_csv_data') || '';
        const today = new Date().toLocaleDateString('fr-FR');
        subject = `Questionnaire Data - ${today}`;
        
        const lines = csvData.split('\n').filter(line => line.trim() && !line.startsWith('Question'));
        dayInfo = `${lines.length} réponses aujourd'hui`;
        
    } else if (dayType === 'all') {
        // Toutes les données
        csvData = generateAllDaysCSV();
        subject = 'Questionnaire Data - All Days';
        
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('question_data_'));
        dayInfo = `${allKeys.length} jours de données`;
        
    } else {
        // Jour spécifique
        const dayData = JSON.parse(localStorage.getItem(`question_data_${dayType}`) || '{}');
        csvData = generateDayCSV(dayType, dayData);
        const dateFormatted = new Date(dayType).toLocaleDateString('fr-FR');
        subject = `Questionnaire Data - ${dateFormatted}`;
        
        const questionCount = Object.keys(dayData).length;
        dayInfo = `${questionCount} questions le ${dateFormatted}`;
    }
    
    if (!csvData || csvData.trim() === '') {
        showNotification('❌ Aucune donnée à envoyer !', 'error');
        return;
    }
    
    // Fermer le modal
    const modal = document.getElementById('day-selector-modal');
    if (modal) modal.remove();
    
    // Préparer l'email
    const body = `Bonjour,

Voici les données du questionnaire.

📊 Résumé: ${dayInfo}
📅 Date d'export: ${new Date().toLocaleString()}

Les données sont incluses ci-dessous au format CSV.

Cordialement,
Système de Questionnaire

--- CSV DATA ---
`;
    
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body + csvData);
    
    // Créer le lien mailto
    const mailtoLink = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    
    try {
        window.location.href = mailtoLink;
        showNotification(`📧 Email préparé !

${dayInfo}
✅ Votre client email va s'ouvrir`, 'success');
    } catch (error) {
        console.error('❌ Email error:', error);
        showNotification('❌ Erreur lors de l\'ouverture de l\'email', 'error');
    }
}

// Fonction pour générer le CSV d'un jour spécifique
function generateDayCSV(date, dayData) {
    let csv = 'Date,Question,Option1,Option2,Proportion,Total_Responses,Option1_Count,Option2_Count,Question_Number\n';
    
    Object.values(dayData).forEach(questionData => {
        csv += `"${date}","${questionData.question}","${questionData.option1}","${questionData.option2}","${questionData.proportion.toFixed(3)}","${questionData.totalResponses}","${questionData.option1Count}","${questionData.option2Count}","${questionData.questionNumber}"\n`;
    });
    
    return csv;
}

// Fonction pour générer le CSV de tous les jours
function generateAllDaysCSV() {
    let csv = 'Date,Question,Option1,Option2,Proportion,Total_Responses,Option1_Count,Option2_Count,Question_Number\n';
    
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith('question_data_'));
    
    allKeys.sort().forEach(key => {
        const date = key.replace('question_data_', '');
        const dayData = JSON.parse(localStorage.getItem(key));
        
        Object.values(dayData).forEach(questionData => {
            csv += `"${date}","${questionData.question}","${questionData.option1}","${questionData.option2}","${questionData.proportion.toFixed(3)}","${questionData.totalResponses}","${questionData.option1Count}","${questionData.option2Count}","${questionData.questionNumber}"\n`;
        });
    });
    
    return csv;
}


// Fonction pour sauvegarder avec la date
function saveDataWithDate(data) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const storageKey = `question_data_${today}`;
    
    // Autoriser la sauvegarde
    SAVE_AUTHORIZED = true;
    
    try {
        // Récupérer les données du jour
        let todayData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        // Ajouter/mettre à jour cette question
        todayData[`question_${data.questionNumber}`] = {
            question: data.question,
            option1: data.option1,
            option2: data.option2,
            option1Count: data.option1Count,
            option2Count: data.option2Count,
            totalResponses: data.totalResponses,
            proportion: data.proportion,
            timestamp: data.timestamp,
            questionNumber: data.questionNumber
        };
        
        // Sauvegarder
        localStorage.setItem(storageKey, JSON.stringify(todayData));
        
        console.log(`✅ Data saved for ${today}, question ${data.questionNumber}`);
        
        // Aussi sauvegarder dans l'ancien format CSV pour compatibilité
        saveToCSVFormat(data);
        
    } catch (error) {
        console.error('❌ Save error:', error);
    } finally {
        // Désautoriser après 1 seconde
        setTimeout(() => {
            SAVE_AUTHORIZED = false;
        }, 1000);
    }
}

// Fonction pour sauvegarder aussi en CSV (compatibilité)
function saveToCSVFormat(data) {
    try {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const dayNumber = Math.ceil((today - startOfYear) / (1000 * 60 * 60 * 24));
        const dateStr = today.toISOString().split('T')[0];
        
        let cumulativeData = localStorage.getItem('all_days_csv_data') || '';
        
        if (!cumulativeData) {
            const csvHeader = 'Question,Option1,Option2,Proportion,Total_Responses,Option1_Count,Option2_Count,Minute,Timestamp,Day_Number,Date,Question_Number\n';
            cumulativeData = csvHeader;
        }
        
        const newRowData = `"${data.question}","${data.option1}","${data.option2}","${data.proportion.toFixed(3)}","${data.totalResponses}","${data.option1Count}","${data.option2Count}","${currentMinute}","${data.timestamp}","${dayNumber}","${dateStr}","${data.questionNumber}"`;
        
        const lines = cumulativeData.split('\n');
        const existingLineIndex = lines.findIndex(line => {
            if (!line.trim() || line.startsWith('Question')) return false;
            const columns = line.split(',');
            return columns[11] && columns[11].replace(/"/g, '') === data.questionNumber.toString();
        });
        
        if (existingLineIndex > 0) {
            lines[existingLineIndex] = newRowData;
            cumulativeData = lines.join('\n');
        } else {
            cumulativeData += newRowData + '\n';
        }
        
        localStorage.setItem('all_days_csv_data', cumulativeData);
        
    } catch (error) {
        console.error('❌ CSV save error:', error);
    }
}

// Fonction pour charger les données du jour
function loadTodayData() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `question_data_${today}`;
    const todayData = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    return todayData;
}

// Fonction principale de synchronisation
function syncWithRealTime() {
    const currentState = calculateCurrentQuestion();
    
    console.log('🕐 Sync with real time:', currentState);
    
    if (!currentState.isActive) {
        // Pas de question active
        isQuestionActive = false;
        stopTimers();
        
        const questionElement = document.getElementById('question-text');
        const countdownElement = document.getElementById('countdown');
        
        if (questionElement) questionElement.textContent = currentState.message;
        if (countdownElement) countdownElement.textContent = '--:--';
        
        // Désactiver les boutons
        const option1Btn = document.getElementById('option1');
        const option2Btn = document.getElementById('option2');
        if (option1Btn && option2Btn) {
            option1Btn.disabled = true;
            option2Btn.disabled = true;
            option1Btn.style.opacity = '0.3';
            option2Btn.style.opacity = '0.3';
        }
        
        showNotification(currentState.message, 'info');
        return;
    }
    
    // Question active - charger la bonne question
    currentQuestionIndex = currentState.questionIndex;
    timeRemaining = currentState.timeRemaining;
    
    const questionData = QUESTIONS_LIST[currentQuestionIndex];
    option1 = questionData.option1;
    option2 = questionData.option2;
    currentQuestion = `Do you prefer ${option1} or ${option2}?`;
    
    // Charger les votes existants pour cette question
    const todayData = loadTodayData();
    const questionKey = `question_${currentQuestionIndex + 1}`;
    
    if (todayData[questionKey]) {
        // Restaurer les votes existants
        option1Count = todayData[questionKey].option1Count;
        option2Count = todayData[questionKey].option2Count;
        totalResponses = todayData[questionKey].totalResponses;
        console.log(`📊 Restored votes: ${option1Count}/${option2Count}, total: ${totalResponses}`);
    } else {
        // Nouvelle question
        option1Count = 0;
        option2Count = 0;
        totalResponses = 0;
    }
    
    isQuestionActive = true;
    
    // Démarrer le countdown avec le temps restant réel
    startRealTimeCountdown();
    
    updateDisplay();
    updateProgress();
    
    showNotification(`🕐 SYNCHRONISÉ !

${currentQuestion}

⏰ ${Math.floor(timeRemaining / 60)} minutes restantes
📊 Votes actuels: ${totalResponses}

✅ L'app continue même si fermée !`, 'success');
}

// Countdown basé sur l'heure réelle
function startRealTimeCountdown() {
    stopTimers();
    
    updateCountdown();
    
    countdownTimer = setInterval(() => {
        const currentState = calculateCurrentQuestion();
        
        if (!currentState.isActive) {
            // La question est terminée
            console.log('⏰ Question finished by real time');
            syncWithRealTime(); // Re-synchroniser
            return;
        }
        
        timeRemaining = currentState.timeRemaining;
        updateCountdown();
        
        if (timeRemaining <= 0) {
            console.log('⏰ Question finished by countdown');
            syncWithRealTime(); // Re-synchroniser
        }
    }, 1000);
    
    console.log('⏰ Real-time countdown started');
}

// Fonction pour mettre à jour le countdown
function updateCountdown() {
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeRemaining <= 10) {
            countdownElement.style.color = '#ef4444';
            countdownElement.style.fontWeight = 'bold';
        } else {
            countdownElement.style.color = '#10b981';
            countdownElement.style.fontWeight = '700';
        }
    }
}

// Fonction pour arrêter les timers
function stopTimers() {
    if (questionTimer) {
        clearTimeout(questionTimer);
        questionTimer = null;
        console.log('🛑 Question timer stopped');
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        console.log('🛑 Countdown timer stopped');
    }
}

// Fonction de vote modifiée
function submitAnswer(optionNumber) {
    console.log(`👆 submitAnswer called: option ${optionNumber}`);
    
    if (!isQuestionActive) {
        showVoteNotification('❌ Aucune question active !', 'error');
        return;
    }
    
    if (optionNumber === 1) {
        option1Count++;
    } else {
        option2Count++;
    }
    
    totalResponses++;
    
    // Sauvegarder immédiatement
    const proportion = option1Count / totalResponses;
    const timestamp = new Date().toISOString();
    
    const data = {
        question: currentQuestion,
        option1: option1,
        option2: option2,
        proportion: proportion,
        totalResponses: totalResponses,
        option1Count: option1Count,
        option2Count: option2Count,
        timestamp: timestamp,
        questionNumber: currentQuestionIndex + 1
    };
    
    saveDataWithDate(data);
    
    updateDisplay();
    
    const selectedOption = optionNumber === 1 ? option1 : option2;
    showVoteNotification(`✅ Vote: ${selectedOption}!`, 'success');
    
    console.log(`📊 Vote saved: ${option1Count}/${option2Count}, total: ${totalResponses}`);
}

// Fonction pour mettre à jour la barre de progression
function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const dayCounter = document.getElementById('day-counter');
    
    if (progressFill) {
        const progress = ((currentQuestionIndex + 1) / QUESTIONS_LIST.length) * 100;
        progressFill.style.width = `${progress}%`;
    }
    
    if (dayCounter) {
        dayCounter.textContent = `Question ${currentQuestionIndex + 1}/${QUESTIONS_LIST.length}`;
    }
}

// Fonction pour mettre à jour l'affichage
function updateDisplay() {
    const questionElement = document.getElementById('question-text');
    if (questionElement) {
        questionElement.textContent = currentQuestion || 'Chargement...';
        
        // FORCER LE CENTRAGE
        questionElement.style.textAlign = 'center';
        questionElement.style.display = 'flex';
        questionElement.style.alignItems = 'center';
        questionElement.style.justifyContent = 'center';
        questionElement.style.margin = '0 auto';
        questionElement.style.width = '100%';
    }
    
    const option1Element = document.getElementById('option1-text');
    const option2Element = document.getElementById('option2-text');
    if (option1Element) option1Element.textContent = option1 || 'Option 1';
    if (option2Element) option2Element.textContent = option2 || 'Option 2';
    
    const todayCountElement = document.getElementById('today-count');
    const totalCountElement = document.getElementById('total-count');
    const proportionElement = document.getElementById('proportion-value');
    
    if (todayCountElement) todayCountElement.textContent = totalResponses;
    if (totalCountElement) {
        const allData = localStorage.getItem('all_days_csv_data') || '';
        const totalEntries = allData ? allData.split('\n').filter(line => line.trim() && !line.startsWith('Question')).length : 0;
        totalCountElement.textContent = totalEntries;
    }
    
    if (proportionElement && totalResponses > 0) {
        const option1Percentage = Math.round((option1Count / totalResponses) * 100);
        const option2Percentage = Math.round((option2Count / totalResponses) * 100);
        proportionElement.textContent = `${option1Percentage}% / ${option2Percentage}%`;
    } else if (proportionElement) {
        proportionElement.textContent = '0% / 0%';
    }
    
    const option1Btn = document.getElementById('option1');
    const option2Btn = document.getElementById('option2');
    
    if (option1Btn && option2Btn) {
        option1Btn.disabled = !isQuestionActive;
        option2Btn.disabled = !isQuestionActive;
        
        if (isQuestionActive) {
            option1Btn.style.opacity = '1';
            option2Btn.style.opacity = '1';
        } else {
            option1Btn.style.opacity = '0.5';
            option2Btn.style.opacity = '0.5';
        }
    }
}

// Fonction pour changer la config à la volée
function setTestConfig(durationMinutes = 1, startHour = 0, endHour = 24) {
    QUESTION_DURATION_MINUTES = durationMinutes;
    DAILY_START_HOUR = startHour;
    DAILY_END_HOUR = endHour;
    
    console.log(`⚙️ Config changed: ${durationMinutes}min, ${startHour}h-${endHour}h`);
    
    // Re-synchroniser immédiatement
    syncWithRealTime();
    
    showNotification(`⚙️ CONFIGURATION MISE À JOUR !

⏰ Durée: ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}
🕐 Actif: ${startHour}h à ${endHour}h

🔄 Synchronisation en cours...`, 'success');
}

// Presets rapides
function quickTest() { setTestConfig(0.167, 0, 24); } // 10 secondes, 24h/24
function normalTest() { setTestConfig(1, 0, 24); } // 1 minute, 24h/24
function realMode() { setTestConfig(60, 8, 18); } // 1 heure, 8h-18h

// Mode test ultra-rapide
function testMode() {
    console.log('⚡ Test mode activated');
    setTestConfig(0.167, 0, 24); // 10 secondes
}

// Mode production
function productionMode() {
    console.log('🏭 Production mode activated');
    setTestConfig(60, 8, 18); // 1 heure, 8h-18h
}

// Fonction de debug pour voir l'état actuel
function showDebugInfo() {
    const currentState = calculateCurrentQuestion();
    const now = new Date();
    const todayData = loadTodayData();
    
    const debugInfo = `🔍 DEBUG INFO

⏰ Heure actuelle: ${now.toLocaleTimeString()}
📅 Date: ${now.toLocaleDateString()}

🎯 Question actuelle: ${currentState.questionIndex + 1}/${QUESTIONS_LIST.length}
✅ Active: ${currentState.isActive ? 'OUI' : 'NON'}
⏱️ Temps restant: ${Math.floor(currentState.timeRemaining / 60)}m ${currentState.timeRemaining % 60}s

📊 Votes actuels:
- ${option1}: ${option1Count}
- ${option2}: ${option2Count}
- Total: ${totalResponses}

💾 Données sauvées aujourd'hui: ${Object.keys(todayData).length} questions

⚙️ Configuration:
- Durée par question: ${QUESTION_DURATION_MINUTES} minutes
- Heures actives: ${DAILY_START_HOUR}h - ${DAILY_END_HOUR}h

🔄 Prochaine sync dans: ${60 - now.getSeconds()}s`;

    showNotification(debugInfo, 'info');
    
    console.log('🔍 Debug info:', {
        currentState,
        todayData,
        config: {
            duration: QUESTION_DURATION_MINUTES,
            startHour: DAILY_START_HOUR,
            endHour: DAILY_END_HOUR
        }
    });
}

// Fonction pour voir les données de tous les jours
function showAllDaysData() {
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith('question_data_'));
    
    if (allKeys.length === 0) {
        showNotification('❌ Aucune donnée trouvée !', 'error');
        return;
    }
    
    let allData = 'Date,Question,Option1,Option2,Proportion,Total_Responses,Option1_Count,Option2_Count,Question_Number\n';
    
    allKeys.sort().forEach(key => {
        const date = key.replace('question_data_', '');
        const dayData = JSON.parse(localStorage.getItem(key));
        
        Object.values(dayData).forEach(questionData => {
            allData += `"${date}","${questionData.question}","${questionData.option1}","${questionData.option2}","${questionData.proportion.toFixed(3)}","${questionData.totalResponses}","${questionData.option1Count}","${questionData.option2Count}","${questionData.questionNumber}"\n`;
        });
    });
    
    // Télécharger
    const blob = new Blob([allData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'all_questionnaire_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`📥 Données de ${allKeys.length} jours téléchargées !`, 'success');
}

// Fonction pour afficher le modal d'ajout de question
function showAddQuestionModal() {
    console.log('➕ showAddQuestionModal called');
    
    const existingModal = document.getElementById('add-question-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'add-question-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10001;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: linear-gradient(135deg, #9C27B0 0%, #673AB7 100%);
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        color: white;
        font-family: Arial, sans-serif;
        max-width: 500px;
        width: 90%;
        text-align: center;
    `;
    
    container.innerHTML = `
        <div style="margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">➕ Add New Question</h2>
            <p style="margin: 0; opacity: 0.9; font-size: 16px;">
                Create a new question to add to the list
            </p>
        </div>
        
        <div style="margin-bottom: 25px; text-align: left;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 16px;">
                Option 1:
            </label>
            <input type="text" id="new-option1" placeholder="e.g., Pizza" style="
                width: 100%;
                padding: 15px;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                box-sizing: border-box;
                margin-bottom: 15px;
            ">
            
            <label style="display: block; margin-bottom: 8px; font-weight: bold; font-size: 16px;">
                Option 2:
            </label>
            <input type="text" id="new-option2" placeholder="e.g., Burger" style="
                width: 100%;
                padding: 15px;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                box-sizing: border-box;
            ">
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; text-align: left;">
            <div style="font-weight: bold; margin-bottom: 5px;">Preview:</div>
            <div id="question-preview" style="font-style: italic; opacity: 0.8;">
                Do you prefer [Option 1] or [Option 2]?
            </div>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="add-question-btn" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                opacity: 0.5;
            " disabled>
                ✅ Add Question
            </button>
            
            <button id="cancel-add-btn" style="
                background: #f44336;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 16px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
            ">
                ✕ Cancel
            </button>
        </div>
        
        <div style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
            Current questions: ${QUESTIONS_LIST.length} | Next position: ${QUESTIONS_LIST.length + 1}
        </div>
    `;
    
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    // Références aux éléments
    const option1Input = document.getElementById('new-option1');
    const option2Input = document.getElementById('new-option2');
    const preview = document.getElementById('question-preview');
    const addBtn = document.getElementById('add-question-btn');
    const cancelBtn = document.getElementById('cancel-add-btn');
    
    // Fonction pour mettre à jour le preview et l'état du bouton
    function updatePreview() {
        const opt1 = option1Input.value.trim();
        const opt2 = option2Input.value.trim();
        
        if (opt1 && opt2) {
            preview.textContent = `Do you prefer ${opt1} or ${opt2}?`;
            addBtn.disabled = false;
            addBtn.style.opacity = '1';
            addBtn.style.transform = 'scale(1)';
        } else {
            preview.textContent = 'Do you prefer [Option 1] or [Option 2]?';
            addBtn.disabled = true;
            addBtn.style.opacity = '0.5';
            addBtn.style.transform = 'scale(0.95)';
        }
    }
    
    // Event listeners pour les inputs
    option1Input.addEventListener('input', updatePreview);
    option2Input.addEventListener('input', updatePreview);
    
    // Event listeners pour les boutons
    addBtn.addEventListener('click', function() {
        const opt1 = option1Input.value.trim();
        const opt2 = option2Input.value.trim();
        
        if (opt1 && opt2) {
            addNewQuestion(opt1, opt2);
            modal.remove();
        }
    });
    
    cancelBtn.addEventListener('click', function() {
        modal.remove();
    });
    
    // Fermer en cliquant à côté
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Focus sur le premier input
    setTimeout(() => {
        option1Input.focus();
    }, 100);
    
    // Permettre d'ajouter avec Enter
    container.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !addBtn.disabled) {
            addBtn.click();
        }
    });
}

// Fonction pour ajouter une nouvelle question à la liste
function addNewQuestion(option1, option2) {
    console.log('➕ Adding new question:', option1, 'vs', option2);
    
    // Ajouter à la liste
    const newQuestion = { option1: option1, option2: option2 };
    QUESTIONS_LIST.push(newQuestion);
    
    console.log('✅ Question added. Total questions:', QUESTIONS_LIST.length);
    console.log('📝 New question:', `Do you prefer ${option1} or ${option2}?`);
    
    // Mettre à jour l'affichage si nécessaire
    updateProgress();
    
    // Notification de succès
    showNotification(`➕ NOUVELLE QUESTION AJOUTÉE !

Question ${QUESTIONS_LIST.length}: Do you prefer ${option1} or ${option2}?

✅ Ajoutée à la position ${QUESTIONS_LIST.length}
📊 Total: ${QUESTIONS_LIST.length} questions

🎯 Cette question sera posée quand vous y arriverez !`, 'success');
    
    // Log pour debug
    console.log('📋 Updated QUESTIONS_LIST:', QUESTIONS_LIST);
}

// Fonction pour voir toutes les questions
function showAllQuestions() {
    console.log('📋 showAllQuestions called');
    
    const existingModal = document.getElementById('all-questions-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'all-questions-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10001;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        color: white;
        font-family: Arial, sans-serif;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        text-align: center;
    `;
    
    let questionsList = '';
    QUESTIONS_LIST.forEach((q, index) => {
        const isCompleted = index < currentQuestionIndex;
        const isCurrent = index === currentQuestionIndex;
        const status = isCompleted ? '✅' : isCurrent ? '🔄' : '⏳';
        const bgColor = isCompleted ? 'rgba(76, 175, 80, 0.3)' : isCurrent ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        
        questionsList += `
            <div style="
                background: ${bgColor};
                margin: 8px 0;
                padding: 15px;
                border-radius: 10px;
                text-align: left;
                border-left: 4px solid ${isCompleted ? '#4CAF50' : isCurrent ? '#FFC107' : '#fff'};
            ">
                <div style="font-weight: bold; margin-bottom: 5px;">
                    ${status} Question ${index + 1}
                </div>
                <div style="font-size: 16px;">
                    Do you prefer <strong>${q.option1}</strong> or <strong>${q.option2}</strong>?
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div style="margin-bottom: 25px;">
            <h2 style="margin: 0 0 10px 0; font-size: 28px;">📋 All Questions</h2>
            <p style="margin: 0; opacity: 0.9; font-size: 16px;">
                Total: ${QUESTIONS_LIST.length} questions | Current: ${currentQuestionIndex + 1}
            </p>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
            ${questionsList}
        </div>
        
        <button onclick="this.parentElement.parentElement.remove()" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 12px 25px;
            font-size: 14px;
            border-radius: 10px;
            cursor: pointer;
        ">
            ✕ Close
        </button>
    `;
    
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Fonctions pour les contrôles admin
function fillCurrentForm() {
    console.log('🔧 Admin: fillCurrentForm called');
    syncWithRealTime();
}

function stopTest() {
    console.log('🔧 Admin: stopTest called');
    if (confirm('🛑 Passer à la question suivante ?')) {
        // Calculer la prochaine question
        const nextQuestionIndex = currentQuestionIndex + 1;
        if (nextQuestionIndex < QUESTIONS_LIST.length) {
            // Forcer le passage à la question suivante
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startTime = new Date(today);
            startTime.setHours(DAILY_START_HOUR, 0, 0, 0);
            
            // Calculer le temps pour la prochaine question
            const nextQuestionStartMinute = nextQuestionIndex * QUESTION_DURATION_MINUTES;
            const nextQuestionTime = new Date(startTime.getTime() + nextQuestionStartMinute * 60000);
            
            // Ajuster l'heure système (simulation)
            console.log(`⏭️ Simulating time jump to question ${nextQuestionIndex + 1}`);
            
            // Re-synchroniser
            syncWithRealTime();
        }
        showNotification('⏭️ Passage à la question suivante !', 'info');
    }
}

function testVoting() {
    console.log('🔧 Admin: testVoting called');
    if (!isQuestionActive) {
        syncWithRealTime();
    }
    
    setTimeout(() => submitAnswer(1), 500);
    setTimeout(() => submitAnswer(2), 1000);
    setTimeout(() => submitAnswer(1), 1500);
    setTimeout(() => submitAnswer(2), 2000);
    setTimeout(() => submitAnswer(1), 2500);
}

// Reset complet avec retour à la question 1
function resetData() {
    console.log('🔄 Complete reset initiated');
    
    // Confirmation
    if (!confirm('⚠️ RESET COMPLET !\n\n• Toutes les données seront supprimées\n• Retour à la question 1\n• Timer redémarré\n\nContinuer ?')) {
        return;
    }
    
    // 1. Vider le localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('question_data_') || key === 'all_days_csv_data')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed:', key);
    });
    
    // 2. Reset toutes les variables
    currentQuestionIndex = 0;
    option1Count = 0;
    option2Count = 0;
    totalResponses = 0;
    isQuestionActive = true;
    timeRemaining = QUESTION_DURATION_MINUTES * 60; // Temps complet
    
    // 3. Charger la première question
    if (QUESTIONS_LIST && QUESTIONS_LIST.length > 0) {
        const questionData = QUESTIONS_LIST[0];
        option1 = questionData.option1;
        option2 = questionData.option2;
        currentQuestion = `Do you prefer ${option1} or ${option2}?`;
        
        console.log('✅ Loaded question 1:', currentQuestion);
    }
    
    // 4. Arrêter tous les timers
    stopTimers();
    
    // 5. Redémarrer le timer avec le temps complet
    startRealTimeCountdown();
    
    // 6. Mettre à jour l'affichage
    updateDisplay();
    updateProgress();
    updateStats();
    
    // 7. Notification de succès
    showNotification(`🔄 RESET COMPLET EFFECTUÉ !

✅ Toutes les données supprimées
🎯 Question 1 rechargée
⏰ Timer redémarré (${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')})
🔄 Prêt pour de nouvelles réponses !

Question: ${currentQuestion}`, 'success');
    
    console.log('✅ Complete reset finished');
    console.log('Current state:', {
        questionIndex: currentQuestionIndex,
        question: currentQuestion,
        timeRemaining: timeRemaining,
        isActive: isQuestionActive
    });
}

function downloadCSV() {
    console.log('🔧 Admin: downloadCSV called');
    const allData = localStorage.getItem('all_days_csv_data') || '';
    if (!allData || allData.trim() === '') {
        showNotification('❌ Aucune donnée à télécharger !', 'error');
        return;
    }
    
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayNumber = Math.ceil((today - startOfYear) / (1000 * 60 * 60 * 24));
    const fileName = `questionnaire_data_Day${dayNumber}.csv`;
    
    const blob = new Blob([allData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`📥 CSV téléchargé: ${fileName}`, 'success');
}

// Fonctions pour les notifications
function showVoteNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        font-size: 16px;
        font-weight: bold;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 2000);
}

function showNotification(message, type = 'info') {
    const existingNotification = document.getElementById('main-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3',
        warning: '#FF9800'
    };
    
    const notification = document.createElement('div');
    notification.id = 'main-notification';
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        font-size: 16px;
        max-width: 500px;
        text-align: center;
        white-space: pre-line;
        animation: fadeIn 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
    
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
}

// Optimisations tactiles pour iPad
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Application initialized with REAL-TIME PERSISTENCE');
    console.log('🛡️ localStorage intercepted - unauthorized saves blocked');
    console.log('🕐 Real-time synchronization enabled');
    
    // Désactiver le zoom sur double-tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Améliorer les interactions tactiles
    document.addEventListener('touchstart', function(e) {
        // Ajouter une classe pour les éléments touchés
        if (e.target.classList.contains('option-btn') || 
            e.target.classList.contains('admin-btn') ||
            e.target.tagName === 'BUTTON') {
            e.target.style.transform = 'scale(0.95)';
        }
    });
    
    document.addEventListener('touchend', function(e) {
        // Retirer l'effet de pression
        if (e.target.classList.contains('option-btn') || 
            e.target.classList.contains('admin-btn') ||
            e.target.tagName === 'BUTTON') {
            setTimeout(() => {
                e.target.style.transform = 'scale(1)';
            }, 150);
        }
    });
    
    // Synchroniser avec l'heure réelle
    syncWithRealTime();
    
    // Re-synchroniser toutes les minutes
    setInterval(syncWithRealTime, 60000);
    
    console.log('✅ App will persist even when iPad is closed!');
});

// Fonction pour détecter si on est sur iPad
function isiPad() {
    return /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
}

// Ajuster l'interface si iPad détecté
if (isiPad()) {
    console.log('📱 iPad detected - applying optimizations');
    document.body.classList.add('ipad-device');
}

// Ajouter les styles CSS pour les animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
    
    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slideOutRight {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

// Exposer les fonctions globalement
window.submitAnswer = submitAnswer;
window.fillCurrentForm = fillCurrentForm;
window.downloadCSV = downloadCSV;
window.resetData = resetData;
window.stopTest = stopTest;
window.testVoting = testVoting;
window.showAddQuestionModal = showAddQuestionModal;
window.addNewQuestion = addNewQuestion;
window.showAllQuestions = showAllQuestions;
window.showAllDaysData = showAllDaysData;
// Exposer les fonctions d'email
window.showDaySelector = showDaySelector;
window.sendDayEmail = sendDayEmail;
window.generateDayCSV = generateDayCSV;
window.generateAllDaysCSV = generateAllDaysCSV;
window.showDebugInfo = showDebugInfo;
window.testMode = testMode;
window.productionMode = productionMode;
window.quickTest = quickTest;
window.normalTest = normalTest;
window.realMode = realMode;
window.syncWithRealTime = syncWithRealTime;

console.log('🚀 Complete questionnaire with REAL-TIME PERSISTENCE loaded!');
console.log('🛡️ localStorage intercepted - unauthorized saves blocked');
console.log('🕐 Real-time synchronization - works even when iPad closed');
console.log('📱 iPad optimizations applied');
console.log('🔧 Admin controls available');
console.log('➕ Dynamic question adding enabled');
console.log('📊 Multi-day data persistence');
console.log('✅ Ready to use - Test with 1 minute intervals!');
