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
let QUESTION_DURATION_MINUTES = 1440; // 1 minute pour tests
let DAILY_START_HOUR = 0; // Actif 24h/24 pour tests
let DAILY_END_HOUR = 24;

// Liste des questions prédéfinies
const QUESTIONS_LIST = [
    { option1: "Dogs", option2: "Cats", template: "Are you more of a {1} or {2} person?" },
    { option1: "Coffee", option2: "Tea", template: "Do you prefer {1} or {2}?" },
    { option1: "Doing sport", option2: "Watch TV", template: "Do you prefer {1} or {2}?" },
    { option1: "Orange", option2: "Green", template: "Do you prefer {1} or {2}?" },
    { option1: "Sea", option2: "Countryside", template: "Where dou you prefre living {1} or {2}?" },
    { option1: "Facebook", option2: "Instagram", template: "Are you more {1} or {2}?" },
    { option1: "Sweet", option2: "Salty", template: "Are you more of a {1} or {2} person?" },
    { option1: "social and expressive", option2: "organized and thoughtful", template: "Are you more {1} or {2}?" },
];

function generateQuestion(questionData) {
    const { option1, option2, template } = questionData;
    
    if (template) {
        // Utiliser le template personnalisé
        return template.replace('{1}', option1).replace('{2}', option2);
    } else {
        // Format par défaut
        return `Do you prefer ${option1} or ${option2}?`;
    }
}
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

function calculateCurrentQuestion() {
    const now = new Date();
    
    // VÉRIFIER SI C'EST UN JOUR DE SEMAINE (1=Lundi, 5=Vendredi)
    const dayOfWeek = now.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend (Dimanche=0, Samedi=6)
        console.log('📅 WEEKEND DÉTECTÉ - App inactive');
        
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + (1 + 7 - dayOfWeek) % 7);
        nextMonday.setHours(0, 0, 0, 0);
        
        return {
            questionIndex: 0,
            isActive: false,
            timeRemaining: 0,
            message: `🏖️ WEEKEND - App inactive\n\n📅 Retour lundi ${nextMonday.toLocaleDateString('fr-FR')}\n⏰ Profitez de votre weekend !`
        };
    }
    
    // CALCULER LE JOUR depuis le LUNDI 11 AOÛT 2025 (SEULEMENT jours de semaine)
    const startDate = new Date('2025-08-11'); // Lundi 11 août 2025 - DÉBUT DU QUESTIONNAIRE
    
    // Calculer le nombre de jours ouvrables depuis le début
    let workDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= now) {
        const currentDayOfWeek = currentDate.getDay();
        if (currentDayOfWeek >= 1 && currentDayOfWeek <= 5) { // Lundi à Vendredi
            workDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Index basé sur les jours ouvrables
    const questionIndex = (workDays - 1) % QUESTIONS_LIST.length;
    
    // Temps restant dans cette journée
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const timeRemaining = Math.floor((endOfDay - now) / 1000);
    
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    console.log('📅 CALCUL JOURS OUVRABLES depuis 11 août 2025:', {
        'Date de début': '11 août 2025 (Lundi)',
        'Date actuelle': now.toLocaleDateString(),
        'Jour': dayNames[dayOfWeek],
        'Jours ouvrables depuis début': workDays,
        'Questions totales': QUESTIONS_LIST.length,
        'Question index': questionIndex,
        'Question numéro': questionIndex + 1,
        'Temps restant': Math.floor(timeRemaining / 3600) + 'h ' + Math.floor((timeRemaining % 3600) / 60) + 'm'
    });
    
    return {
        questionIndex: questionIndex,
        isActive: true,
        timeRemaining: Math.max(1, timeRemaining),
        message: `Question ${questionIndex + 1}/${QUESTIONS_LIST.length} (Jour ouvrable ${workDays} depuis le 11 août)`
    };
}


// Fonction pour afficher le sélecteur de jour
function showDaySelector() {
    console.log('📧 Sending today CSV directly');
    
    // VOTRE EMAIL ICI
    const MY_EMAIL = "gueulette.l@pg.com";
    
    // Récupérer les données d'aujourd'hui
    const csvData = localStorage.getItem('all_days_csv_data') || '';
    
    if (!csvData || csvData.trim() === '') {
        showNotification('❌ Aucune donnée à envoyer !', 'error');
        return;
    }
    
    const today = new Date().toLocaleDateString('fr-FR');
    const lines = csvData.split('\n').filter(line => line.trim() && !line.startsWith('Question'));
    
    const subject = `📊 Questionnaire Data - ${today}`;
    const body = `📊 DONNÉES QUESTIONNAIRE

Bonjour,

Voici les données du questionnaire d'aujourd'hui.

📈 Résumé: ${lines.length} réponses le ${today}
📅 Export généré le: ${new Date().toLocaleString('fr-FR')}

Les données sont au format CSV ci-dessous :

--- DONNÉES CSV ---
${csvData}
--- FIN DES DONNÉES ---

Cordialement,
📱 Système de Questionnaire`;
    
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const mailtoLink = `mailto:${MY_EMAIL}?subject=${encodedSubject}&body=${encodedBody}`;
    
    try {
        window.location.href = mailtoLink;
        showNotification(`📧 EMAIL PRÉPARÉ !

📮 À: ${MY_EMAIL}
📊 ${lines.length} réponses d'aujourd'hui
✉️ Appuyez "Envoyer" dans Mail !`, 'success');
    } catch (error) {
        showNotification('❌ Erreur email', 'error');
    }
}

// Fonction pour envoyer l'email d'un jour spécifique
function sendDayEmail(dayType) {
    console.log('📧 sendDayEmail called for:', dayType);
    
    // VOTRE EMAIL ICI - CHANGEZ CETTE LIGNE !
    const MY_EMAIL = "gueulette.l@pg.com"; // ← METTEZ VOTRE VRAIE ADRESSE
    
    let csvData = '';
    let subject = '';
    let dayInfo = '';
    
    if (dayType === 'today') {
        // Données CSV d'aujourd'hui
        csvData = localStorage.getItem('all_days_csv_data') || '';
        const today = new Date().toLocaleDateString('fr-FR');
        subject = `📊 Questionnaire Data - ${today}`;
        
        const lines = csvData.split('\n').filter(line => line.trim() && !line.startsWith('Question'));
        dayInfo = `${lines.length} réponses aujourd'hui`;
        
    } else if (dayType === 'all') {
        // Toutes les données
        csvData = generateAllDaysCSV();
        subject = '📊 Questionnaire Data - All Days';
        
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('question_data_'));
        dayInfo = `${allKeys.length} jours de données`;
        
    } else {
        // Jour spécifique
        const dayData = JSON.parse(localStorage.getItem(`question_data_${dayType}`) || '{}');
        csvData = generateDayCSV(dayType, dayData);
        const dateFormatted = new Date(dayType).toLocaleDateString('fr-FR');
        subject = `📊 Questionnaire Data - ${dateFormatted}`;
        
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
    
    // Corps de l'email amélioré
    const body = `📊 DONNÉES QUESTIONNAIRE

Bonjour,

Voici les données du questionnaire demandées.

📈 Résumé: ${dayInfo}
📅 Export généré le: ${new Date().toLocaleString('fr-FR')}
🎯 Type de données: ${dayType === 'today' ? 'Aujourd\'hui' : dayType === 'all' ? 'Tous les jours' : 'Jour spécifique'}

Les données sont incluses ci-dessous au format CSV.
Vous pouvez les copier dans Excel ou Google Sheets.

Cordialement,
📱 Système de Questionnaire

--- DONNÉES CSV ---
${csvData}

--- FIN DES DONNÉES ---

🔧 Généré automatiquement depuis l'app Questionnaire
📱 Envoyé depuis iPhone/Safari`;
    
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    // Créer le lien mailto AVEC VOTRE EMAIL PRÉ-REMPLI
    const mailtoLink = `mailto:${MY_EMAIL}?subject=${encodedSubject}&body=${encodedBody}`;
    
    console.log('📧 Preparing email to:', MY_EMAIL);
    console.log('📊 Data type:', dayType);
    console.log('📈 Info:', dayInfo);
    
    try {
        window.location.href = mailtoLink;
        
        showNotification(`📧 EMAIL PRÉPARÉ !

📮 Destinataire: ${MY_EMAIL}
📊 Contenu: ${dayInfo}
📅 ${subject}

✉️ Votre app Mail va s'ouvrir
Il suffit d'appuyer "Envoyer" !`, 'success');
        
    } catch (error) {
        console.error('❌ Email error:', error);
        showNotification(`❌ Erreur email

Impossible d'ouvrir le client email.
Vérifiez que Mail est configuré.

📧 Email cible: ${MY_EMAIL}`, 'error');
    }
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
    // Si on ajoute une question, ne pas synchroniser
    if (addingQuestion) {
        console.log('⏸️ Sync paused - adding question');
        return;
    }
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
    currentQuestion = generateQuestion(questionData);
    
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
    console.log(`👆 Vote pour option ${optionNumber}`);
    
    if (!isQuestionActive) {
        showVoteNotification('❌ Aucune question active !', 'error');
        return;
    }
    
    // Incrémenter les votes
    if (optionNumber === 1) {
        option1Count++;
        window.option1Count = option1Count; // Forcer la variable globale
    } else {
        option2Count++;
        window.option2Count = option2Count; // Forcer la variable globale
    }
    
    totalResponses++;
    window.totalResponses = totalResponses; // Forcer la variable globale
    
    console.log(`📊 Nouveau total: ${option1Count} vs ${option2Count} (total: ${totalResponses})`);
    
    // Sauvegarder
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
    
    // Mettre à jour l'affichage
    updateDisplay();
    
    const selectedOption = optionNumber === 1 ? option1 : option2;
    showVoteNotification(`✅ Vote: ${selectedOption}!`, 'success');
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

function updateDisplay() {
    console.log('🔄 updateDisplay called');
    
    try {
        // Mettre à jour la question
        const questionElement = document.getElementById('question-text');
        if (questionElement) {
            questionElement.textContent = currentQuestion;
        }
        
        // Boutons sans votes
        const option1Element = document.getElementById('option1-text');
        const option2Element = document.getElementById('option2-text');
        
        if (option1Element) option1Element.textContent = option1;
        if (option2Element) option2Element.textContent = option2;
        
        // CORRIGER: Total Questions = questions répondues aujourd'hui
        const totalCountElement = document.getElementById('total-count');
        if (totalCountElement) {
            const today = new Date().toISOString().split('T')[0];
            const todayData = JSON.parse(localStorage.getItem(`question_data_${today}`) || '{}');
            const questionsAnsweredToday = Object.keys(todayData).length;
            totalCountElement.textContent = questionsAnsweredToday.toString();
        }
        
        // Votes actuels
        const todayCountElement = document.getElementById('today-count');
        if (todayCountElement) {
            todayCountElement.textContent = totalResponses.toString();
        }
        
        // Proportion
        const proportionElement = document.getElementById('proportion-value');
        if (proportionElement) {
            const option1Percent = totalResponses > 0 ? Math.round((option1Count / totalResponses) * 100) : 0;
            const option2Percent = totalResponses > 0 ? Math.round((option2Count / totalResponses) * 100) : 0;
            proportionElement.textContent = `${option1Percent}% / ${option2Percent}%`;
        }
        
        console.log('✅ Display updated');
        
    } catch (error) {
        console.error('❌ updateDisplay error:', error);
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
let addingQuestion = false; // Variable globale

function addNewQuestion() {
    console.log('🎯 Adding new question with template support...');
    
    const option1 = prompt("🎯 Option 1:");
    if (!option1 || option1.trim() === '') {
        console.log('❌ No option1 provided');
        return;
    }
    
    const option2 = prompt("🎯 Option 2:");
    if (!option2 || option2.trim() === '') {
        console.log('❌ No option2 provided');
        return;
    }
    
    // NOUVEAU : Demander le format personnalisé
    const customTemplate = prompt(`🎯 Format de question (optionnel):

Exemples :
• "Do you prefer {1} or {2}?" (défaut)
• "Are you more {1} or {2}?"
• "Would you rather be {1} or {2}?"
• "Are you team {1} or team {2}?"

Laissez vide pour le format par défaut.
Utilisez {1} et {2} pour les options.`);
    
    console.log('💾 Saving question with template:', option1, 'vs', option2, 'template:', customTemplate);
    
    try {
        // Récupérer les questions existantes
        let savedQuestions = localStorage.getItem('my_custom_questions');
        let questionsList = savedQuestions ? JSON.parse(savedQuestions) : [];
        
        console.log('📥 Existing questions:', questionsList.length);
        
        // Créer la nouvelle question
        const newQuestion = {
            option1: option1.trim(),
            option2: option2.trim(),
            dateAdded: new Date().toISOString()
        };
        
        // Ajouter le template si fourni
        if (customTemplate && customTemplate.trim()) {
            newQuestion.template = customTemplate.trim();
            console.log('✅ Template added:', customTemplate.trim());
        }
        
        questionsList.push(newQuestion);
        
        // Sauvegarder
        localStorage.setItem('my_custom_questions', JSON.stringify(questionsList));
        
        // Ajouter à la liste active
        QUESTIONS_LIST.push(newQuestion);
        
        console.log('✅ Question saved! Total questions:', QUESTIONS_LIST.length);
        console.log('💾 LocalStorage content:', localStorage.getItem('my_custom_questions'));
        
        // Prévisualiser la question générée
        const preview = generateQuestion(newQuestion);
        
        alert(`✅ QUESTION AJOUTÉE !

Aperçu: ${preview}

Options: "${option1}" vs "${option2}"
${customTemplate ? `Template: "${customTemplate}"` : 'Format: Par défaut'}

Total questions: ${QUESTIONS_LIST.length}
Sauvée dans localStorage !`);
        
    } catch (error) {
        console.error('❌ Error saving question:', error);
        alert('❌ Erreur: ' + error.message);
    }
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

function resetData() {
    if (!confirm('🔄 RESET TOTAL ?\n\n⚠️ Ceci va EFFACER :\n• Toutes les données sauvées\n• Tous les emails possibles\n• Toutes les statistiques\n\nContinuer ?')) {
        return;
    }
    
    console.log('🔄 RESET TOTAL - Effacement complet');
    
    // ARRÊTER tous les timers
    stopTimers();
    
    // 1. EFFACER TOUTE LA MÉMOIRE PERSISTANTE
    SAVE_AUTHORIZED = true; // Autoriser les suppressions
    
    try {
        // Effacer toutes les données de questionnaire
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('question_data_') || 
                key === 'all_days_csv_data' || 
                key === 'my_custom_questions' ||
                key === 'custom_questions_list') {
                localStorage.removeItem(key);
                console.log('🗑️ Supprimé:', key);
            }
        });
        
        console.log('✅ localStorage complètement effacé');
        
    } catch (error) {
        console.error('❌ Erreur effacement:', error);
    } finally {
        SAVE_AUTHORIZED = false;
    }
    
    // 2. RESET COMPLET des variables
    currentQuestionIndex = 0;
    option1Count = 0;
    option2Count = 0;
    totalResponses = 0;
    
    // 3. Première question
    const q = QUESTIONS_LIST[0];
    option1 = q.option1;
    option2 = q.option2;
    currentQuestion = `Do you prefer ${option1} or ${option2}?`;
    
    // 4. Reset timer
    timeRemaining = QUESTION_DURATION_MINUTES * 60;
    isQuestionActive = true;
    
    // 5. Réactiver les boutons
    const option1Btn = document.getElementById('option1');
    const option2Btn = document.getElementById('option2');
    if (option1Btn && option2Btn) {
        option1Btn.disabled = false;
        option2Btn.disabled = false;
        option1Btn.style.opacity = '1';
        option2Btn.style.opacity = '1';
    }
    
    // 6. Mise à jour forcée
    setTimeout(() => {
        updateDisplay();
        updateProgress();
        startRealTimeCountdown();
    }, 200);
    
    showNotification(`🔄 RESET TOTAL TERMINÉ !

✅ Toutes les données effacées
✅ Plus d'emails possibles
✅ Statistiques remises à zéro
✅ Question 1 rechargée

Vous repartez de zéro !`, 'success');
}

function goToNextQuestion() {
    console.log('➡️ goToNextQuestion called');
    
    // Passer à la question suivante
    currentQuestionIndex = (currentQuestionIndex + 1) % QUESTIONS_LIST.length;
    
    // Charger la nouvelle question
    const q = QUESTIONS_LIST[currentQuestionIndex];
    option1 = q.option1;
    option2 = q.option2;
    currentQuestion = generateQuestion(q);
    
    // Reset votes pour cette question
    option1Count = 0;
    option2Count = 0;
    totalResponses = 0;
    
    // Reset timer
    timeRemaining = QUESTION_DURATION_MINUTES * 60;
    isQuestionActive = true;
    
    updateDisplay();
    updateProgress();
    startRealTimeCountdown();
    
    showNotification(`➡️ QUESTION SUIVANTE !

Question ${currentQuestionIndex + 1}: ${currentQuestion}
Prêt à voter !`, 'success');
}

// Exposer les fonctions
window.resetData = resetData;
window.goToNextQuestion = goToNextQuestion;

console.log('✅ Emergency functions loaded');




// Clé pour sauvegarder les questions personnalisées
const CUSTOM_QUESTIONS_KEY = 'custom_questions_list';

// Charger les questions sauvegardées au démarrage
function loadCustomQuestions() {
    try {
        const savedQuestions = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
        if (savedQuestions) {
            const customQuestions = JSON.parse(savedQuestions);
            console.log('📥 Loading custom questions:', customQuestions.length);
            
            // Fusionner avec les questions par défaut
            QUESTIONS_LIST = [...QUESTIONS_LIST, ...customQuestions];
            
            console.log('✅ Total questions loaded:', QUESTIONS_LIST.length);
            return customQuestions.length;
        }
    } catch (error) {
        console.error('❌ Error loading custom questions:', error);
    }
    return 0;
}

// Sauvegarder une nouvelle question
function saveCustomQuestion(option1, option2) {
    try {
        // Récupérer les questions existantes
        const savedQuestions = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
        let customQuestions = savedQuestions ? JSON.parse(savedQuestions) : [];
        
        // Créer la nouvelle question
        const newQuestion = {
            option1: option1.trim(),
            option2: option2.trim(),
            dateAdded: new Date().toISOString(),
            id: Date.now() // ID unique
        };
        
        // Vérifier si elle existe déjà
        const exists = customQuestions.some(q => 
            q.option1.toLowerCase() === option1.toLowerCase() && 
            q.option2.toLowerCase() === option2.toLowerCase()
        );
        
        if (exists) {
            console.log('⚠️ Question already exists');
            return false;
        }
        
        // Ajouter la nouvelle question
        customQuestions.push(newQuestion);
        
        // Sauvegarder dans localStorage
        localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(customQuestions));
        
        // Ajouter à la liste active
        QUESTIONS_LIST.push(newQuestion);
        
        console.log('💾 Custom question saved:', newQuestion);
        console.log('📊 Total questions now:', QUESTIONS_LIST.length);
        
        return true;
    } catch (error) {
        console.error('❌ Error saving custom question:', error);
        return false;
    }
}

// Supprimer une question personnalisée
function deleteCustomQuestion(questionId) {
    try {
        const savedQuestions = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
        if (!savedQuestions) return false;
        
        let customQuestions = JSON.parse(savedQuestions);
        const originalLength = customQuestions.length;
        
        // Filtrer pour supprimer la question
        customQuestions = customQuestions.filter(q => q.id !== questionId);
        
        if (customQuestions.length < originalLength) {
            // Sauvegarder la liste mise à jour
            localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(customQuestions));
            
            // Recharger toutes les questions
            reloadAllQuestions();
            
            console.log('🗑️ Custom question deleted');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Error deleting custom question:', error);
        return false;
    }
}

// Recharger toutes les questions (défaut + personnalisées)
function reloadAllQuestions() {
    // Reset à la liste par défaut
    QUESTIONS_LIST = [
        { option1: "Coffee", option2: "Tea" },
        { option1: "Summer", option2: "Winter" },
        { option1: "Movies", option2: "Books" },
        { option1: "Beach", option2: "Mountains" },
        { option1: "Pizza", option2: "Burger" }
    ];
    
    // Recharger les questions personnalisées
    loadCustomQuestions();
}

// Charger les questions au démarrage
function loadMyCustomQuestions() {
    console.log('📥 Loading custom questions...');
    
    try {
        const saved = localStorage.getItem('my_custom_questions');
        if (saved) {
            const customQuestions = JSON.parse(saved);
            console.log('📥 Found custom questions:', customQuestions.length);
            
            // Ajouter à la liste
            customQuestions.forEach(q => {
                QUESTIONS_LIST.push(q);
            });
            
            console.log('✅ Total questions loaded:', QUESTIONS_LIST.length);
            return customQuestions.length;
        }
    } catch (error) {
        console.error('❌ Error loading questions:', error);
    }
    
    return 0;
}

// Auto-charger au démarrage
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const loaded = loadMyCustomQuestions();
        if (loaded > 0) {
            console.log(`✅ Loaded ${loaded} custom questions`);
        }
    }, 1000);
});
// Fonction pour voir toutes les questions personnalisées
function viewCustomQuestions() {
    try {
        const savedQuestions = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
        if (!savedQuestions) {
            showNotification('📝 AUCUNE QUESTION PERSONNALISÉE\n\nUtilisez "Add Question" pour en ajouter !', 'info');
            return;
        }
        
        const customQuestions = JSON.parse(savedQuestions);
        
        let message = `📝 QUESTIONS PERSONNALISÉES (${customQuestions.length})\n\n`;
        
        customQuestions.forEach((q, index) => {
            const date = new Date(q.dateAdded).toLocaleDateString();
            message += `${index + 1}. "${q.option1}" vs "${q.option2}"\n   📅 Ajoutée le ${date}\n\n`;
        });
        
        message += `💾 Total questions: ${QUESTIONS_LIST.length}\n🔄 Ces questions restent après reload !`;
        
        showNotification(message, 'info');
        
    } catch (error) {
        console.error('❌ Error viewing custom questions:', error);
        showNotification('❌ Erreur lors de la lecture des questions', 'error');
    }
}

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Loading custom questions...');
    const customCount = loadCustomQuestions();
    
    if (customCount > 0) {
        console.log(`✅ Loaded ${customCount} custom questions`);
        showNotification(`📥 ${customCount} questions personnalisées chargées !

📊 Total: ${QUESTIONS_LIST.length} questions
💾 Vos questions sont sauvegardées !`, 'success');
    }
});


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
    
    // SOLUTION UNIVERSELLE - iPhone + PC Windows
    try {
        // Créer le blob avec BOM pour Excel
        const BOM = '\uFEFF'; // Byte Order Mark pour UTF-8
        const csvContent = BOM + allData;
        const blob = new Blob([csvContent], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        // Détecter le navigateur/OS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            // Internet Explorer
            window.navigator.msSaveOrOpenBlob(blob, fileName);
        } else {
            // Tous les autres navigateurs (Chrome, Firefox, Safari, Edge)
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            
            // Attributs pour Safari iOS
            if (isIOS || isSafari) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            
            // Ajouter au DOM, cliquer, nettoyer
            document.body.appendChild(link);
            link.click();
            
            // Nettoyer après un délai
            setTimeout(() => {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
                URL.revokeObjectURL(url);
            }, 100);
        }
        
        // Message adapté selon la plateforme
        let message = `📥 CSV téléchargé: ${fileName}\n\n`;
        
        if (isIOS) {
            message += `📱 iPhone/iPad:\n• Vérifiez l'app Fichiers > Téléchargements\n• Ou Safari > Téléchargements`;
        } else {
            message += `💻 PC Windows:\n• Vérifiez votre dossier Téléchargements\n• Ou la barre de téléchargement du navigateur`;
        }
        
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('❌ Download error:', error);
        showNotification(`❌ Erreur de téléchargement: ${error.message}`, 'error');
    }
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
    setInterval(syncWithRealTime, 300000);
    
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

/*
// Fonction pour forcer le mode weekend (pour tests)
function forceWeekendMode() {
    console.log('🏖️ FORCING WEEKEND MODE for testing');
    
    // Simuler un samedi
    const originalGetDay = Date.prototype.getDay;
    Date.prototype.getDay = function() {
        return 6; // Samedi
    };
    
    syncWithRealTime();
    
    showNotification(`🏖️ MODE WEEKEND FORCÉ !

L'app est maintenant inactive comme si c'était samedi.

📅 Début du questionnaire : Lundi 11 août 2025

Pour revenir au mode normal :
- Rechargez la page
- Ou appelez normalMode()`, 'warning');
}

// Fonction pour revenir au mode normal
function normalMode() {
    console.log('📅 BACK TO NORMAL MODE');
    location.reload(); // Simple rechargement
}
*/

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
//window.showDaySelector = showDaySelector;
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
//window.forceWeekendMode = forceWeekendMode;
//window.normalMode = normalMode;

console.log('🚀 Complete questionnaire with REAL-TIME PERSISTENCE loaded!');
console.log('🛡️ localStorage intercepted - unauthorized saves blocked');
console.log('🕐 Real-time synchronization - works even when iPad closed');
console.log('📱 iPad optimizations applied');
console.log('🔧 Admin controls available');
console.log('➕ Dynamic question adding enabled');
console.log('📊 Multi-day data persistence');
console.log('✅ Ready to use - Test with 1 minute intervals!');
