
export const translations = {
  it: {
    app_name: "RUNSET",
    app_subtitle: "Logistica Set Cinematografici",
    select_role: "Seleziona il tuo ruolo",
    role_producer: "Produttore",
    role_producer_desc: "Gestisci set, runner e troupe",
    role_runner: "Runner",
    role_runner_desc: "Visualizza i set e naviga verso i task",
    producer_access: "Accesso Produttore",
    enter_passcode: "Inserisci il codice a 4 cifre",
    access_denied: "Accesso Negato",
    back: "Indietro",
    version: "v1.1.0 • Accesso Protetto",
    skip: "Salta",
    
    // Access Gate
    system_lock: "SISTEMA BLOCCATO",
    authorized_only: "Solo Personale Autorizzato",
    enter_master_code: "Inserisci Master Code per accedere",
    verifying: "Verifica in corso...",
    
    // Sidebar
    dashboard: "DASHBOARD",
    sets: "Sets",
    runners: "Runner",
    actors: "Attori",
    troupe: "Troupe",
    no_sets: "Nessun set salvato.",
    logout: "Log Out",
    producer_name_placeholder: "Nome e Cognome Produttore",
    producer_phone_placeholder: "Numero di Telefono",
    
    // Map & Info
    details: "DETTAGLI",
    contact: "CONTATTA",
    live_tracking: "Live Tracking",
    set_card: "Scheda Set",
    contact_card: "Scheda Contatto",
    direct_contact: "Contatto Diretto",
    operative_notes: "Note Operative",
    call: "Chiama",
    navigate: "Naviga",
    delete: "Elimina",
    
    // Alerts
    alert_sent: "Alert {type} Inviato",
    traffic: "Traffico",
    emergency: "Imprevisto",
    fuel: "Pausa Benzina",
    emergency_reported: "Imprevisto Segnalato",
    emergency_desc: "Notifica inviata al produttore. Come vuoi procedere ora?",
    send_whatsapp: "Manda WhatsApp",
    whatsapp_desc: "Testo pre-compilato",
    call_now: "Chiama Subito",
    call_desc: "Avvia Telefonata",
    no_producer_phone: "Numero Produttore non impostato",
    whatsapp_msg: "RUNSET: Imprevisto sul set. Sono {name}, ho bisogno di assistenza immediata.",
    
    // Banners
    add_runner: "Aggiungi Runner",
    add_actor: "Aggiungi Attore",
    add_troupe: "Aggiungi Membro Troupe",
    save_contact: "Salva Contatto",
    full_name: "Nome Completo",
    role_dept: "Ruolo / Reparto",
    phone: "Telefono",
    assign_runner: "Assegna a Runner",
    new_set: "Nuovo Set",
    set_name: "Nome Set",
    address: "Indirizzo",
    set_manager: "Set Manager",
    internal_notes: "Note Interne",
    save_set: "Salva Set Point",
    map_pin: "Pin Mappa",
    
    // Runner Selection
    who_are_you: "Chi sei?",
    select_from_list: "Seleziona il tuo nome dalla lista runner",
    no_runners_config: "Nessun runner configurato dal produttore."
  },
  en: {
    app_name: "RUNSET",
    app_subtitle: "Cinema Set Logistics",
    select_role: "Select your role",
    role_producer: "Producer",
    role_producer_desc: "Manage sets, runners, and crew",
    role_runner: "Runner",
    role_runner_desc: "View locations and navigate tasks",
    producer_access: "Producer Access",
    enter_passcode: "Enter the 4-digit code",
    access_denied: "Access Denied",
    back: "Back",
    version: "v1.1.0 • Protected Access",
    skip: "Skip",

    // Access Gate
    system_lock: "SYSTEM LOCKED",
    authorized_only: "Authorized Personnel Only",
    enter_master_code: "Enter Master Code to access",
    verifying: "Verifying...",
    
    // Sidebar
    dashboard: "DASHBOARD",
    sets: "Sets",
    runners: "Runners",
    actors: "Actors",
    troupe: "Crew",
    no_sets: "No sets saved.",
    logout: "Log Out",
    producer_name_placeholder: "Producer Name",
    producer_phone_placeholder: "Phone Number",
    
    // Map & Info
    details: "DETAILS",
    contact: "CONTACT",
    live_tracking: "Live Tracking",
    set_card: "Set Info",
    contact_card: "Contact Info",
    direct_contact: "Direct Contact",
    operative_notes: "Operative Notes",
    call: "Call",
    navigate: "Navigate",
    delete: "Delete",
    
    // Alerts
    alert_sent: "Alert {type} Sent",
    traffic: "Traffic",
    emergency: "Incident",
    fuel: "Fuel Break",
    emergency_reported: "Incident Reported",
    emergency_desc: "Notification sent to producer. How do you want to proceed?",
    send_whatsapp: "Send WhatsApp",
    whatsapp_desc: "Pre-filled text",
    call_now: "Call Now",
    call_desc: "Start Call",
    no_producer_phone: "Producer phone not set",
    whatsapp_msg: "RUNSET: Set incident. I'm {name}, I need immediate assistance.",
    
    // Banners
    add_runner: "Add Runner",
    add_actor: "Add Actor",
    add_troupe: "Add Crew Member",
    save_contact: "Save Contact",
    full_name: "Full Name",
    role_dept: "Role / Dept",
    phone: "Phone",
    assign_runner: "Assign to Runner",
    new_set: "New Set",
    set_name: "Set Name",
    address: "Address",
    set_manager: "Set Manager",
    internal_notes: "Internal Notes",
    save_set: "Save Set Point",
    map_pin: "Map Pin",
    
    // Runner Selection
    who_are_you: "Who are you?",
    select_from_list: "Select your name from the runner list",
    no_runners_config: "No runners configured by the producer."
  }
};

export type Language = 'it' | 'en';
export type TranslationKey = keyof typeof translations.it;
