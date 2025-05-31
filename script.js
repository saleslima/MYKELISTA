import { initializeApp } from 'firebase/app';
// Import 'get' for one-time data fetching
import { getDatabase, ref, push, set, onValue, remove, update, get } from 'firebase/database';

// Provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-U3nYN7M_NpW7bvaqE9BT_--o7RfBcqY",
  authDomain: "controle-gastos-9539d.firebaseapp.com",
  databaseURL: "https://controle-gastos-9539d-default-rtdb.firebaseio.com",
  projectId: "controle-gastos-9539d",
  storageBucket: "controle-gastos-9539d.firebasestorage.app",
  messagingSenderId: "538009752360",
  appId: "1:538009752360:web:5be290d4183fc5e886361d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const usersRef = ref(database, 'usuarios'); // Reference to the 'usuarios' node

// DOM Elements
const loginSection = document.getElementById('login-section');
const rankingContainer = document.getElementById('ranking-container');
const loginForm = document.getElementById('login-form');
const loginEquipeSelect = document.getElementById('login-equipe');
const loginSenhaInput = document.getElementById('login-senha');
const loginErrorElement = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button'); // Added logout button

const form = document.getElementById('military-form');
const firebaseKeyInput = document.getElementById('firebase-key');
const equipeSelect = document.getElementById('equipe'); // Added equipe select
const postoGraduacaoSelect = document.getElementById('posto-graduacao');
const nomeGuerraInput = document.getElementById('nome-guerra');
const reInput = document.getElementById('re'); // This is now type="text"
const dataPromocaoInput = document.getElementById('data-promocao');
const senhaInput = document.getElementById('senha');
const statusSelect = document.getElementById('status'); // Added Status select
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit');
const rankingTableBody = document.getElementById('ranking-table-body');
const searchReInput = document.getElementById('search-re'); // Get the new search input
const rankingTeamNameElement = document.getElementById('ranking-team-name'); // Element to display logged-in team

// Store all users data retrieved from Firebase globally, sorted by global rank
let allUsersGlobal = [];
// Store the logged-in team
let loggedInTeam = null;

// Define the rank hierarchy for sorting (higher index = lower rank)
// This determines the automatic sort order.
const rankHierarchy = [
    "Coronel", "Tenente-Coronel", "Major", "Capitão",
    "1º Tenente", "2º Tenente", "Aspirante", "Subtenente",
    "1º Sargento", "2º Sargento", "3º Sargento", "Cabo", "Soldado", "Soldado 2ª Classe"
];

// Function to get the sorting value of a rank
function getRankSortValue(rank) {
    const index = rankHierarchy.indexOf(rank);
    // If rank not found, put it at the end (or handle error)
    return index === -1 ? rankHierarchy.length : index;
}

// --- Login/Logout Logic ---

function showLogin() {
    loginSection.classList.remove('hidden');
    rankingContainer.classList.add('hidden');
    loggedInTeam = null; // Clear logged in team
    localStorage.removeItem('loggedInTeam'); // Clear local storage
    loginErrorElement.textContent = ''; // Clear any previous error
    loginForm.reset(); // Reset login form
}

function showRanking(team) {
    loginSection.classList.add('hidden');
    rankingContainer.classList.remove('hidden');
    loggedInTeam = team;
    localStorage.setItem('loggedInTeam', team); // Store logged in team
    rankingTeamNameElement.textContent = team; // Update ranking header

    // Trigger display ranking with the current data (onValue listener will update it)
    displayRanking(allUsersGlobal);
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const team = loginEquipeSelect.value.toUpperCase();
    const senha = loginSenhaInput.value.toUpperCase();

    if (!team) {
        loginErrorElement.textContent = 'Por favor, selecione uma equipe.';
        return;
    }

    const expectedPassword = team + 'SUPER';

    if (senha === expectedPassword) {
        showRanking(team);
        // The onValue listener is already active and will populate the data
    } else {
        loginErrorElement.textContent = 'Senha incorreta.';
         loginSenhaInput.value = ''; // Clear password field
    }
});

logoutButton.addEventListener('click', () => {
    showLogin();
    resetForm(); // Reset the military form as well
     // Clear the displayed ranking table
     rankingTableBody.innerHTML = ''; // Clear table on logout
     rankingTeamNameElement.textContent = 'Toda Equipe'; // Reset header text
});


// --- CRUD Operations ---

// Create/Update Data
form.addEventListener('submit', async (e) => { // Make the event listener async to use await inside
    e.preventDefault();

    const key = firebaseKeyInput.value;
    const equipe = equipeSelect.value.toUpperCase(); // Get equipe value
    const postoGraduacao = postoGraduacaoSelect.value; // Value uses the full name
    const nomeGuerra = nomeGuerraInput.value.toUpperCase(); // Convert to uppercase
    const reString = reInput.value.trim(); // Get RE value as string and trim whitespace
    const dataPromocaoValue = dataPromocaoInput.value; // Get value from date input
    const senha = senhaInput.value.toUpperCase(); // Convert to uppercase
    const status = statusSelect.value; // Get Status value

    // --- RE Validation ---
    // 1. Check if RE contains exactly 6 digits
    const reRegex = /^\d{6}$/;
    if (!reRegex.test(reString)) {
        alert('O campo RE deve conter exatamente 6 dígitos numéricos.');
        reInput.focus(); // Focus on the RE field
        return;
    }
    const re = parseInt(reString, 10); // Parse the validated string to an integer
    // --- End RE Validation ---


    // Basic validation for other required fields (Equipe, P/G, Nome de Guerra, Senha, Status)
    // RE is already validated above for format
    if (!equipe || !postoGraduacao || !nomeGuerra || !senha || !status) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // Fetch all users for validation checks (Data Promoção and RE uniqueness)
    // Use the globally available allUsersGlobal which is kept updated by the onValue listener
    const existingUsersArray = allUsersGlobal;


    // ** Validation Logic 1: Data Promoção mandatory if same rank exists (except Soldado/Sd 2ª Cl) **
    try {
        const usersWithSameRank = existingUsersArray.filter(user =>
            user.key !== key && user.postoGraduacao === postoGraduacao
        );

        const isSoldadoRank = postoGraduacao === "Soldado" || postoGraduacao === "Soldado 2ª Classe";

        // If rank is not Soldado/Sd 2ª Cl AND there are other users with the same rank AND Data Promoção is missing
        if (!isSoldadoRank && usersWithSameRank.length > 0 && !dataPromocaoValue) {
             alert('A Data Promoção é obrigatória para esta P/G, pois já existem outros militares com a mesma graduação. Informe a data mais antiga para determinar a precedência.');
             dataPromocaoInput.focus(); // Focus on the Data Promoção field
             return;
        }

    } catch (error) {
        console.error("Erro ao verificar usuários existentes para validação (Data Promoção): ", error);
    }
    // ** End Validation Logic 1 **

    // ** Validation Logic 2: RE must be unique across all users **
    try {
        const existingUserWithSameRE = existingUsersArray.find(user =>
            // Compare parsed integer RE values
            user.key !== key && user.re === re
        );

        if (existingUserWithSameRE) {
            alert(`O RE ${reString} já está cadastrado para o militar ${existingUserWithSameRE.nomeGuerra} (${existingUserWithSameRE.postoGraduacao}). Um RE só pode pertencer a um militar.`);
            reInput.focus(); // Focus on the RE field
            return;
        }

    } catch (error) {
        console.error("Erro ao verificar RE existente: ", error);
    }
    // ** End Validation Logic 2 **


    const newDataPromocao = dataPromocaoValue || null;

    const userData = {
        equipe,
        postoGraduacao,
        nomeGuerra,
        re: re, // Store the parsed integer RE
        dataPromocao: newDataPromocao,
        senha,
        status
    };

    try {
        if (key) {
            await update(ref(database, `usuarios/${key}`), userData);
            alert('Militar atualizado com sucesso!');

        } else {
            const newUserRef = push(usersRef);
            await set(newUserRef, userData);
            alert('Militar cadastrado com sucesso!');
        }

        resetForm();
        // onValue listener will automatically update the display

    } catch (error) {
        console.error("Erro ao salvar militar: ", error);
        alert('Erro ao salvar militar.');
    }
});

// Delete Data
function deleteUser(key) {
    if (confirm('Tem certeza que deseja excluir este militar?')) {
        const userRef = ref(database, `usuarios/${key}`);
        remove(userRef)
            .then(() => {
                alert('Militar excluído com sucesso!');
                 // onValue listener will automatically update the display
            })
            .catch((error) => {
                console.error("Erro ao excluir militar: ", error);
                alert('Erro ao excluir militar.');
            });
    }
}

// Populate form for Editing
function editUser(key, userData) {
    firebaseKeyInput.value = key;
    equipeSelect.value = userData.equipe || '';
    postoGraduacaoSelect.value = userData.postoGraduacao;
    nomeGuerraInput.value = userData.nomeGuerra;
    reInput.value = userData.re; // Populate text input with the RE value
    dataPromocaoInput.value = userData.dataPromocao || '';
    senhaInput.value = userData.senha;
    statusSelect.value = userData.status || 'NORMAL';

    submitButton.textContent = 'Atualizar';
    cancelEditButton.style.display = 'inline-block';

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Cancel Edit
cancelEditButton.addEventListener('click', resetForm);

function resetForm() {
    firebaseKeyInput.value = '';
    form.reset();
    submitButton.textContent = 'Cadastrar';
    cancelEditButton.style.display = 'none';
    searchReInput.value = ''; // Clear search input when cancelling edit
    statusSelect.value = 'NORMAL'; // Ensure status defaults correctly on reset
     // Ensure equipe select is reset
    equipeSelect.value = '';
}

// --- Read Data and Display Ranking ---

onValue(usersRef, (snapshot) => {
    const usersData = snapshot.val();
    let usersArray = []; // This will hold ALL users initially

    if (usersData) {
        for (const key in usersData) {
            usersArray.push({
                key,
                ...usersData[key]
            });
        }

        // Ensure RE is treated as a number for sorting, even if stored inconsistently
        usersArray.forEach(user => {
            user.re = parseInt(user.re, 10);
            if (isNaN(user.re)) {
                console.warn(`Invalid RE found for user ${user.key}:`, usersData[user.key].re);
                user.re = 0; // Assign a value that places invalid REs predictably (e.g., at the start or end)
            }
        });

        // Sort the ENTIRE array globally based on rank, date, then RE
        usersArray.sort((a, b) => {
            const rankAValue = getRankSortValue(a.postoGraduacao);
            const rankBValue = getRankSortValue(b.postoGraduacao);

            if (rankAValue < rankBValue) {
                return -1;
            }
            if (rankAValue > rankBValue) {
                return 1;
            }

            const dateA = a.dataPromocao;
            const dateB = b.dataPromocao;

            // Handle missing dates: records with dates rank higher than those without
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;

            // If both have dates, compare dates (older date = higher rank)
            if (dateA && dateB) {
                 if (dateA < dateB) { // Older date ranks higher
                    return -1;
                }
                if (dateA > dateB) {
                    return 1;
                }
            }

            // If ranks and dates are equal (or both missing), compare RE (lower RE = higher rank)
            const reA = a.re;
            const reB = b.re;

            if (reA < reB) {
                return -1;
            }
            if (reA > reB) {
                return 1;
            }

            return 0; // If all criteria are equal
        });

        // Update the global array with the full, sorted data
        allUsersGlobal = usersArray;

        // Call displayRanking with the FULL sorted list
        // displayRanking will handle filtering by loggedInTeam
        displayRanking(allUsersGlobal);

    } else {
        // Handle case where there is no data in Firebase
        allUsersGlobal = [];
        displayRanking([]); // Display empty ranking
    }

}, (error) => { // This is the error callback
    console.error("Erro ao carregar dados do Firebase: ", error);
    rankingTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Erro ao carregar dados.</td></tr>';
});


// Displays the ranking, filtered by the logged-in team
// usersToDisplay parameter should ideally be the full sorted global list
function displayRanking(usersToDisplay) {
    rankingTableBody.innerHTML = '';

    // Filter users by logged-in team if loggedInTeam is not null
    // The input 'usersToDisplay' is assumed to be the full, globally sorted list
    const filteredUsers = loggedInTeam
        ? usersToDisplay.filter(user => user.equipe === loggedInTeam)
        : []; // If no team is logged in, show an empty list

    if (filteredUsers.length === 0) { // Check length of filtered list
        if (loggedInTeam) { // If a team is logged in but no users found for that team
             rankingTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">Nenhum militar encontrado para a equipe ${loggedInTeam}.</td></tr>`;
        } else { // If no team is logged in (initial state or after logout)
             rankingTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Faça login para ver o ranking.</td></tr>';
        }
         return;
    }


    filteredUsers.forEach((user, index) => {
        const row = document.createElement('tr');
        // displayedRank is calculated based on the index within the *filtered* team list
        const displayedRank = index + 1;

        row.innerHTML = `
            <td>${displayedRank}º</td>
            <td>${user.equipe || ''}</td>
            <td>${user.postoGraduacao}</td>
            <td>${user.nomeGuerra}</td>
            <td>${user.re}</td>
            <td>${user.dataPromocao || ''}</td>
            <td>${user.status || 'NORMAL'}</td>
            <td>
                <button class="edit-btn" data-key="${user.key}">Editar</button>
                <button class="delete-btn" data-key="${user.key}">Excluir</button>
            </td>
        `;
        rankingTableBody.appendChild(row);
    });

    // Attach event listeners for edit/delete buttons
     rankingTableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            // Find the user in the ALL users array (required for editing any user)
            const userToEdit = allUsersGlobal.find(user => user.key === key);
            if (userToEdit) {
                 editUser(key, userToEdit);
            } else {
                console.error("User data not found in local array for key:", key);
                alert("Erro ao carregar dados do militar para edição.");
            }
        });
    });

     rankingTableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            deleteUser(key);
        });
    });
}

// --- Search Functionality ---

searchReInput.addEventListener('input', (e) => {
    // Search input remains type="number" for easier input on mobile keyboards
    const searchTerm = parseInt(e.target.value, 10);

    // If search term is empty or not a valid number
    if (isNaN(searchTerm) || e.target.value.trim() === '') {
         resetForm(); // Reset the form fields (clears any previous search result)
         // redisplay the filtered team list (done by onValue if active, but better to trigger explicitly)
         displayRanking(allUsersGlobal);
         return; // Exit the function
    }

    // Search the global array (which contains parsed REs)
    const foundUser = allUsersGlobal.find(user => user.re === searchTerm);

    if (foundUser) {
        // If found, populate the form for editing
        editUser(foundUser.key, foundUser);
        // Optional: Highlight or scroll to the found user in the table if visible?
        // For now, just populating the form is sufficient based on prompt.
    } else {
        // If not found, reset the form but keep the search RE in the search input
        const currentSearchValue = searchReInput.value; // Save the search value
        resetForm(); // Reset the form fields
        searchReInput.value = currentSearchValue; // Restore the search value
         // Clear the table display when a search finds no result
         rankingTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">RE ${searchTerm} não encontrado.</td></tr>`;
    }
});


// --- Initial Load ---
// Check if a team is already logged in from local storage
const storedTeam = localStorage.getItem('loggedInTeam');
if (storedTeam) {
    showRanking(storedTeam);
    // The onValue listener is already active and will populate the data when it loads
} else {
    showLogin();
}