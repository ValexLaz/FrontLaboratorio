// ===== CONFIGURACIÓN =====
const API_CONFIG = {
    TEST_TYPES_SERVICE: 'http://localhost:5262',
    RESULTS_SERVICE: 'http://localhost:5272', 
    RESULT_FIELDS_SERVICE: 'http://localhost:5175',
    AUTH_SERVICE: 'http://localhost:3000/api/Auth'
};

// ===== VARIABLES GLOBALES =====
let testTypesData = [];
let resultsData = [];
let resultFieldsData = [];
let currentUser = null;
let authToken = null;

// ===== GESTIÓN DE AUTENTICACIÓN =====
class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
    }

    init() {
        console.log('🚀 Inicializando AuthManager...');
        
        // 🔧 CORRECCIÓN: Primero intentar desde localStorage
        try {
            const storedToken = localStorage.getItem('labAuthToken');
            const storedUserStr = localStorage.getItem('labCurrentUser');
            
            if (storedToken && storedUserStr) {
                console.log('✅ Token y usuario encontrados en localStorage');
                this.token = storedToken;
                this.user = JSON.parse(storedUserStr);
                
                // Copiar a variables globales del dashboard
                authToken = this.token;
                currentUser = this.user;
                
                // También mantener en window para compatibilidad
                window.labAuthToken = this.token;
                window.labCurrentUser = this.user;
                
                console.log('✅ Datos de autenticación cargados desde localStorage');
                return true;
            }
        } catch (storageError) {
            console.log('❌ Error leyendo localStorage:', storageError);
        }
        
        // Fallback: intentar desde variables globales del login
        if (window.labAuthToken && window.labCurrentUser) {
            console.log('✅ Token y usuario encontrados desde variables globales');
            this.token = window.labAuthToken;
            this.user = window.labCurrentUser;
            
            // Copiar a variables globales del dashboard
            authToken = this.token;
            currentUser = this.user;
            
            // Intentar guardar en localStorage para próximas cargas
            try {
                localStorage.setItem('labAuthToken', this.token);
                localStorage.setItem('labCurrentUser', JSON.stringify(this.user));
                console.log('💾 Datos guardados en localStorage');
            } catch (storageError) {
                console.log('❌ No se pudo guardar en localStorage:', storageError);
            }
            
            return true;
        }
        
        console.log('❌ No hay autenticación válida');
        return false;
    }


     getAuthHeaders() {
        if (!this.token) {
            throw new Error('No hay token de autenticación');
        }
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async verifyToken() {
        try {
            console.log('🔐 Verificando token con el backend...');
            
            const response = await fetch(`${API_CONFIG.AUTH_SERVICE}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                console.log('❌ Token inválido - respuesta:', response.status);
                throw new Error(`Token inválido: ${response.status}`);
            }

            const userData = await response.json();
            console.log('✅ Token verificado exitosamente:', userData);
            
            // 🔧 CORRECCIÓN: Actualizar tanto localStorage como variables
            this.user = userData;
            currentUser = userData;
            window.labCurrentUser = userData;
            
            try {
                localStorage.setItem('labCurrentUser', JSON.stringify(userData));
                console.log('💾 Datos de usuario actualizados en localStorage');
            } catch (storageError) {
                console.log('❌ Error actualizando localStorage:', storageError);
            }
            
            return userData;
        } catch (error) {
            console.error('❌ Error verificando token:', error);
            this.logout();
            throw error;
        }
    }

    logout() {
        console.log('🚪 Cerrando sesión...');
        
        // 🔧 CORRECCIÓN: Limpiar localStorage y variables globales
        this.token = null;
        this.user = null;
        authToken = null;
        currentUser = null;
        
        // Limpiar localStorage
        try {
            localStorage.removeItem('labAuthToken');
            localStorage.removeItem('labCurrentUser');
            console.log('🧹 localStorage limpiado');
        } catch (storageError) {
            console.log('❌ Error limpiando localStorage:', storageError);
        }
        
        // Limpiar variables del login también
        delete window.labAuthToken;
        delete window.labCurrentUser;
        
        this.redirectToLogin();
    }

    redirectToLogin() {
        console.log('🔄 Redirigiendo a login...');
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        const authenticated = this.token && this.user;
        console.log('🔍 ¿Está autenticado?', authenticated);
        return authenticated;
    }

    getUser() {
        return this.user;
    }
}

// Instancia global del gestor de autenticación
const authManager = new AuthManager();

// ===== FUNCIONES DE UTILIDAD =====
function showAlert(message, type = 'success') {
    console.log(`📢 Alerta [${type}]: ${message}`);
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        activeTab.insertBefore(alertDiv, activeTab.firstChild);
    }
    
    setTimeout(() => alertDiv.remove(), 5000);
}

function handleApiError(error, operation) {
    console.error(`❌ Error en ${operation}:`, error);
    
    if (error.message.includes('401') || error.message.includes('Token') || error.message.includes('Unauthorized')) {
        showAlert('Sesión expirada. Redirigiendo al login...', 'error');
        setTimeout(() => authManager.logout(), 2000);
        return;
    }
    
    showAlert(`Error al ${operation}: ${error.message}`, 'error');
}

async function authenticatedFetch(url, options = {}) {
    try {
        console.log('🔐 Petición autenticada a:', url);
        
        if (!authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado');
        }

        const authHeaders = authManager.getAuthHeaders();
        const finalOptions = {
            ...options,
            headers: {
                ...authHeaders,
                ...options.headers
            }
        };

        const response = await fetch(url, finalOptions);
        
        if (response.status === 401) {
            throw new Error('Token expirado o inválido');
        }
        
        return response;
    } catch (error) {
        console.error('❌ Error en petición autenticada:', error);
        if (error.message.includes('autenticación') || error.message.includes('Token')) {
            authManager.logout();
        }
        throw error;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== UI COMPONENTS =====
function createUserHeader() {
    const user = authManager.getUser();
    if (!user) return '';

    return `
        <div class="user-header">
            <div class="user-info">
                <span class="user-email">👤 ${user.Email || user.email || 'Usuario'}</span>
                <span class="user-id">ID: ${user.UserId || user.id || '-'}</span>
            </div>
            <button class="btn btn-danger" onclick="handleLogout()" style="padding: 8px 15px; font-size: 0.9rem;">
                Cerrar Sesión
            </button>
        </div>
    `;
}

function handleLogout() {
    if (confirm('¿Está seguro de cerrar sesión?')) {
        authManager.logout();
    }
}

// ===== NAVEGACIÓN =====
function showTab(tabName) {
    console.log('📱 Cambiando a pestaña:', tabName);
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-tab').forEach(button => {
        button.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'test-types':
            loadAllTestTypes();
            break;
        case 'results':
            loadAllResults();
            break;
        case 'result-fields':
            loadAllResultFields();
            break;
    }
}

function openModal(modalId) {
    console.log('📱 Abriendo modal:', modalId);
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    console.log('📱 Cerrando modal:', modalId);
    document.getElementById(modalId).classList.remove('show');
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
}


// ===== DASHBOARD =====
async function loadDashboardData() {
    console.log('📊 Cargando datos del dashboard...');
    try {
        const [testTypes, results, resultFields] = await Promise.all([
            fetchAllTestTypes(),
            fetchAllResults(),
            fetchAllResultFields()
        ]);
        
        document.getElementById('total-test-types').textContent = testTypes.length;
        document.getElementById('total-results').textContent = results.length;
        document.getElementById('total-result-fields').textContent = resultFields.length;
        
        console.log('✅ Dashboard cargado exitosamente');
    } catch (error) {
        handleApiError(error, 'cargar estadísticas del dashboard');
    }
}


// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando Dashboard...');
    
    try {
        // Inicializar AuthManager
        const hasAuth = authManager.init();
        if (!hasAuth) {
            console.log('❌ No hay autenticación válida, redirigiendo...');
            authManager.redirectToLogin();
            return;
        }

        // Verificar token con el backend
        await authManager.verifyToken();
        console.log('✅ Autenticación verificada exitosamente');

        // Mostrar información del usuario en el header
        const headerElement = document.querySelector('.header');
        if (headerElement) {
            headerElement.innerHTML += createUserHeader();
        }
        
        // Configurar componentes
        setupForms();
        setupModalEvents();
        setupKeyboardShortcuts();
        setupErrorHandling();
        
        // Cargar datos iniciales
        await loadDashboardData();
        
        // Iniciar auto-refresh
        startAutoRefresh(60);
        
        console.log('✅ Dashboard inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando Dashboard:', error);
        showAlert('Error al inicializar el dashboard. Redirigiendo al login...', 'error');
        setTimeout(() => authManager.logout(), 3000);
    }
});
// ===== TEST TYPES SERVICE =====
async function fetchAllTestTypes() {
    console.log('📋 Obteniendo test types...');
    const response = await fetch(`${API_CONFIG.TEST_TYPES_SERVICE}/api/TestTypes`);
    if (!response.ok) throw new Error('Error al obtener test types');
    return await response.json();
}

async function createTestType(testTypeData) {
    console.log('➕ Creando test type:', testTypeData);
    const response = await fetch(`${API_CONFIG.TEST_TYPES_SERVICE}/api/TestTypes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testTypeData)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al crear test type');
    }
    return response;
}

async function updateTestType(testTypeId, testTypeData) {
    console.log('✏️ Actualizando test type:', testTypeId, testTypeData);
    const response = await fetch(`${API_CONFIG.TEST_TYPES_SERVICE}/api/TestTypes/${testTypeId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testTypeData)
    });
    
    if (!response.ok) throw new Error('Error al actualizar test type');
    return response;
}

async function deleteTestType(testTypeId) {
    console.log('🗑️ Eliminando test type:', testTypeId);
    const response = await fetch(`${API_CONFIG.TEST_TYPES_SERVICE}/api/TestTypes/${testTypeId}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Error al eliminar test type');
    return response;
}

async function loadAllTestTypes() {
    console.log('📋 Cargando todos los test types...');
    try {
        testTypesData = await fetchAllTestTypes();
        renderTestTypesTable(testTypesData);
        console.log('✅ Test types cargados:', testTypesData.length);
    } catch (error) {
        handleApiError(error, 'cargar test types');
        document.getElementById('test-types-data').innerHTML = '<div class="alert alert-error">Error al cargar test types</div>';
    }
}

function renderTestTypesTable(testTypes) {
    const container = document.getElementById('test-types-data');
    
    if (testTypes.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No se encontraron test types</div>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Test Type ID</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Created At</th>
                    <th>Updated At</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${testTypes.map(testType => `
                    <tr>
                        <td><strong>${testType.testTypeId}</strong></td>
                        <td>${testType.name}</td>
                        <td>${testType.description || '-'}</td>
                        <td>${formatDate(testType.createdAt)}</td>
                        <td>${formatDate(testType.updatedAt)}</td>
                        <td>
                            <button class="btn btn-primary" onclick="editTestType(${testType.testTypeId})" style="margin-right: 5px;">
                                Editar
                            </button>
                            <button class="btn btn-danger" onclick="deleteTestTypeHandler(${testType.testTypeId})">
                                Eliminar
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

async function deleteTestTypeHandler(testTypeId) {
    if (!confirm('¿Está seguro de eliminar este test type?')) return;
    
    try {
        await deleteTestType(testTypeId);
        showAlert('Test type eliminado correctamente');
        loadAllTestTypes();
    } catch (error) {
        handleApiError(error, 'eliminar test type');
    }
}

function editTestType(testTypeId) {
    const testType = testTypesData.find(tt => tt.testTypeId === testTypeId);
    if (!testType) return;
    
    document.getElementById('test-type-name').value = testType.name;
    document.getElementById('test-type-description').value = testType.description || '';
    
    document.querySelector('#create-test-type-modal .modal-title').textContent = 'Editar Test Type';
    
    const form = document.getElementById('create-test-type-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleUpdateTestType(testTypeId);
    };
    
    openModal('create-test-type-modal');
}

async function handleUpdateTestType(testTypeId) {
    const testTypeData = {
        name: document.getElementById('test-type-name').value,
        description: document.getElementById('test-type-description').value
    };
    
    try {
        await updateTestType(testTypeId, testTypeData);
        showAlert('Test type actualizado correctamente');
        closeModal('create-test-type-modal');
        loadAllTestTypes();
        resetTestTypeForm();
    } catch (error) {
        handleApiError(error, 'actualizar test type');
    }
}

function resetTestTypeForm() {
    document.querySelector('#create-test-type-modal .modal-title').textContent = 'Crear Nuevo Test Type';
    
    const form = document.getElementById('create-test-type-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleCreateTestType();
    };
}

async function handleCreateTestType() {
    const testTypeData = {
        name: document.getElementById('test-type-name').value,
        description: document.getElementById('test-type-description').value
    };
    
    try {
        await createTestType(testTypeData);
        showAlert('Test type creado correctamente');
        closeModal('create-test-type-modal');
        loadAllTestTypes();
        resetTestTypeForm();
    } catch (error) {
        handleApiError(error, 'crear test type');
    }
}

// ===== RESULTS SERVICE =====
async function fetchAllResults() {
    console.log('📊 Obteniendo results...');
    const response = await fetch(`${API_CONFIG.RESULTS_SERVICE}/api/Results`);
    if (!response.ok) throw new Error('Error al obtener results');
    return await response.json();
}

async function fetchResultsByOrderId(orderId) {
    const response = await fetch(`${API_CONFIG.RESULTS_SERVICE}/api/Results/orders/${orderId}`);
    if (!response.ok) throw new Error('Error al obtener results por order ID');
    return await response.json();
}

async function fetchResultsByPatientId(patientId) {
    const response = await fetch(`${API_CONFIG.RESULTS_SERVICE}/api/Results/patients/${patientId}`);
    if (!response.ok) throw new Error('Error al obtener results por patient ID');
    return await response.json();
}

async function createResult(resultData) {
    console.log('➕ Creando result con autenticación:', resultData);
    const response = await authenticatedFetch(`${API_CONFIG.RESULTS_SERVICE}/api/Results`, {
        method: 'POST',
        body: JSON.stringify(resultData)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al crear result');
    }
    return response;
}

async function deleteResult(resultId) {
    console.log('🗑️ Eliminando result con autenticación:', resultId);
    const response = await authenticatedFetch(`${API_CONFIG.RESULTS_SERVICE}/api/Results/${resultId}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Error al eliminar result');
    return response;
}

async function loadAllResults() {
    console.log('📊 Cargando todos los results...');
    try {
        resultsData = await fetchAllResults();
        renderResultsTable(resultsData);
        console.log('✅ Results cargados:', resultsData.length);
    } catch (error) {
        handleApiError(error, 'cargar results');
        document.getElementById('results-data').innerHTML = '<div class="alert alert-error">Error al cargar results</div>';
    }
}

async function loadResultsByFilter() {
    const orderId = document.getElementById('filter-order-id').value;
    const patientId = document.getElementById('filter-patient-id').value;
    
    console.log('🔍 Filtrando results - Order ID:', orderId, 'Patient ID:', patientId);
    
    try {
        let results = [];
        
        if (orderId) {
            results = await fetchResultsByOrderId(orderId);
        } else if (patientId) {
            results = await fetchResultsByPatientId(patientId);
        } else {
            loadAllResults();
            return;
        }
        
        renderResultsTable(results);
    } catch (error) {
        handleApiError(error, 'filtrar results');
    }
}

function renderResultsTable(results) {
    const container = document.getElementById('results-data');
    
    if (results.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No se encontraron results</div>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Result ID</th>
                    <th>Order ID</th>
                    <th>Patient ID</th>
                    <th>Test Type ID</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => `
                    <tr>
                        <td>${result.resultId}</td>
                        <td>${result.orderId}</td>
                        <td>${result.patientId}</td>
                        <td>${result.testTypeId}</td>
                        <td><span class="badge badge-${result.status?.toLowerCase()}">${result.status}</span></td>
                        <td>${formatDate(result.createdAt)}</td>
                        <td>
                            <button class="btn btn-danger" onclick="deleteResultHandler(${result.resultId})">
                                Eliminar
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

async function deleteResultHandler(resultId) {
    if (!confirm('¿Está seguro de eliminar este result?')) return;
    
    try {
        await deleteResult(resultId);
        showAlert('Result eliminado correctamente');
        loadAllResults();
    } catch (error) {
        handleApiError(error, 'eliminar result');
    }
}

// ===== RESULT FIELDS SERVICE =====
async function fetchAllResultFields() {
    console.log('📝 Obteniendo result fields...');
    const response = await fetch(`${API_CONFIG.RESULT_FIELDS_SERVICE}/api/ResultFields`);
    if (!response.ok) throw new Error('Error al obtener result fields');
    return await response.json();
}

async function createResultField(resultFieldData) {
    console.log('➕ Creando result field:', resultFieldData);
    const response = await fetch(`${API_CONFIG.RESULT_FIELDS_SERVICE}/api/ResultFields`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultFieldData)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al crear result field');
    }
    return response;
}

async function deleteResultField(resultFieldId) {
    console.log('🗑️ Eliminando result field:', resultFieldId);
    const response = await fetch(`${API_CONFIG.RESULT_FIELDS_SERVICE}/api/ResultFields/${resultFieldId}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Error al eliminar result field');
    return response;
}

async function updateResultField(resultFieldId, resultFieldData) {
    console.log('✏️ Actualizando result field:', resultFieldId, resultFieldData);
    const response = await fetch(`${API_CONFIG.RESULT_FIELDS_SERVICE}/api/ResultFields/${resultFieldId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultFieldData)
    });
    
    if (!response.ok) throw new Error('Error al actualizar result field');
    return response;
}

async function loadAllResultFields() {
    console.log('📝 Cargando todos los result fields...');
    try {
        resultFieldsData = await fetchAllResultFields();
        renderResultFieldsTable(resultFieldsData);
        console.log('✅ Result fields cargados:', resultFieldsData.length);
    } catch (error) {
        handleApiError(error, 'cargar result fields');
        document.getElementById('result-fields-data').innerHTML = '<div class="alert alert-error">Error al cargar result fields</div>';
    }
}

function renderResultFieldsTable(resultFields) {
    const container = document.getElementById('result-fields-data');
    
    if (resultFields.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No se encontraron result fields</div>';
        return;
    }
    
    const table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Result Field ID</th>
                    <th>Result ID</th>
                    <th>Test Type ID</th>
                    <th>Field ID</th>
                    <th>Value</th>
                    <th>Comment</th>
                    <th>Created At</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${resultFields.map(rf => `
                    <tr>
                        <td>${rf.resultFieldId}</td>
                        <td>${rf.resultId}</td>
                        <td>${rf.testTypeId}</td>
                        <td>${rf.fieldId}</td>
                        <td><strong>${rf.value}</strong></td>
                        <td>${rf.comment || '-'}</td>
                        <td>${formatDate(rf.createdAt)}</td>
                        <td>
                            <button class="btn btn-primary" onclick="editResultField(${rf.resultFieldId})" style="margin-right: 5px;">
                                Editar
                            </button>
                            <button class="btn btn-danger" onclick="deleteResultFieldHandler(${rf.resultFieldId})">
                                Eliminar
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = table;
}

async function deleteResultFieldHandler(resultFieldId) {
    if (!confirm('¿Está seguro de eliminar este result field?')) return;
    
    try {
        await deleteResultField(resultFieldId);
        showAlert('Result field eliminado correctamente');
        loadAllResultFields();
    } catch (error) {
        handleApiError(error, 'eliminar result field');
    }
}

function editResultField(resultFieldId) {
    const resultField = resultFieldsData.find(rf => rf.resultFieldId === resultFieldId);
    if (!resultField) return;
    
    document.getElementById('rf-result-id').value = resultField.resultId;
    document.getElementById('rf-test-type-id').value = resultField.testTypeId;
    document.getElementById('rf-field-id').value = resultField.fieldId;
    document.getElementById('rf-value').value = resultField.value;
    document.getElementById('rf-comment').value = resultField.comment || '';
    
    document.querySelector('#create-result-field-modal .modal-title').textContent = 'Editar Result Field';
    
    const form = document.getElementById('create-result-field-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleUpdateResultField(resultFieldId);
    };
    
    openModal('create-result-field-modal');
}

async function handleCreateResultField() {
    const resultFieldData = {
        resultId: parseInt(document.getElementById('rf-result-id').value),
        testTypeId: parseInt(document.getElementById('rf-test-type-id').value),
        fieldId: parseInt(document.getElementById('rf-field-id').value),
        value: document.getElementById('rf-value').value,
        comment: document.getElementById('rf-comment').value
    };
    
    try {
        await createResultField(resultFieldData);
        showAlert('Result field creado correctamente');
        closeModal('create-result-field-modal');
        loadAllResultFields();
        resetResultFieldForm();
    } catch (error) {
        handleApiError(error, 'crear result field');
    }
}

async function handleUpdateResultField(resultFieldId) {
    const resultFieldData = {
        value: document.getElementById('rf-value').value,
        comment: document.getElementById('rf-comment').value
    };
    
    try {
        await updateResultField(resultFieldId, resultFieldData);
        showAlert('Result field actualizado correctamente');
        closeModal('create-result-field-modal');
        loadAllResultFields();
        resetResultFieldForm();
    } catch (error) {
        handleApiError(error, 'actualizar result field');
    }
}

function resetResultFieldForm() {
    document.querySelector('#create-result-field-modal .modal-title').textContent = 'Crear Nuevo Result Field';
    
    const form = document.getElementById('create-result-field-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleCreateResultField();
    };
}

// ===== CONFIGURACIÓN DE FORMULARIOS =====
function setupForms() {
    console.log('📝 Configurando formularios...');
    
    // Form handler para Test Types
    const testTypeForm = document.getElementById('create-test-type-form');
    if (testTypeForm) {
        testTypeForm.onsubmit = async (e) => {
            e.preventDefault();
            await handleCreateTestType();
        };
    }
    
    // Form handler para Results
    const resultForm = document.getElementById('create-result-form');
    if (resultForm) {
        resultForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const resultData = {
                orderId: parseInt(document.getElementById('result-order-id').value),
                patientId: parseInt(document.getElementById('result-patient-id').value),
                testTypeId: parseInt(document.getElementById('result-test-type-id').value),
                status: document.getElementById('result-status').value
            };
            
            try {
                await createResult(resultData);
                showAlert('Result creado correctamente');
                closeModal('create-result-modal');
                loadAllResults();
            } catch (error) {
                handleApiError(error, 'crear result');
            }
        };
    }
    
    // Form handler para Result Fields
    const resultFieldForm = document.getElementById('create-result-field-form');
    if (resultFieldForm) {
        resultFieldForm.onsubmit = async (e) => {
            e.preventDefault();
            await handleCreateResultField();
        };
    }
}

function setupModalEvents() {
    // Cerrar modales al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        };
    });
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Escape para cerrar modales
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                closeModal(modal.id);
            });
        }
        
        // Ctrl+R para refrescar datos de la pestaña activa
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const tabId = activeTab.id;
                showTab(tabId);
            }
        }
    });
}

// ===== AUTO-REFRESH =====
let autoRefreshInterval;

function startAutoRefresh(intervalSeconds = 60) {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'dashboard') {
            loadDashboardData();
        }
    }, intervalSeconds * 1000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ===== ERROR HANDLING GLOBAL =====
function setupErrorHandling() {
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ Error no manejado:', event.reason);
        showAlert('Ha ocurrido un error inesperado', 'error');
    });
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando Dashboard...');
    
    try {
        // Inicializar AuthManager
        const hasAuth = authManager.init();
        if (!hasAuth) {
            console.log('❌ No hay autenticación válida, redirigiendo...');
            authManager.redirectToLogin();
            return;
        }

        // Verificar token con el backend
        await authManager.verifyToken();
        console.log('✅ Autenticación verificada exitosamente');

        // Mostrar información del usuario en el header
        const headerElement = document.querySelector('.header');
        if (headerElement) {
            headerElement.innerHTML += createUserHeader();
        }
        
        // Configurar componentes
        setupForms();
        setupModalEvents();
        setupKeyboardShortcuts();
        setupErrorHandling();
        
        // Cargar datos iniciales
        await loadDashboardData();
        
        // Iniciar auto-refresh
        startAutoRefresh(60);
        
        console.log('✅ Dashboard inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando Dashboard:', error);
        showAlert('Error al inicializar el dashboard. Redirigiendo al login...', 'error');
        setTimeout(() => authManager.logout(), 3000);
    }
});

// Cleanup al cerrar la página
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});

// ===== FUNCIONES GLOBALES PARA HTML =====
// Estas funciones se exponen globalmente para ser llamadas desde el HTML
window.showTab = showTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleLogout = handleLogout;
window.loadResultsByFilter = loadResultsByFilter;
window.deleteTestTypeHandler = deleteTestTypeHandler;
window.editTestType = editTestType;
window.deleteResultHandler = deleteResultHandler;
window.deleteResultFieldHandler = deleteResultFieldHandler;
window.editResultField = editResultField;