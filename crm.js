import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rjfryrxpefqhassrunwr.supabase.co';
const supabaseKey = 'sb_publishable_c9YI8BVA46ERMS-Jnq2Oqw_ws6536BW';
const supabase = createClient(supabaseUrl, supabaseKey);

let db = { clients: [], socialPosts: [], trafficCampaigns: [] };

async function loadDB() {
    const [clientsRes, postsRes, trafficRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('posts').select('*'),
        supabase.from('traffic').select('*')
    ]);

    db.clients = (clientsRes.data || []).map(c => ({
        id: c.id,
        name: c.name,
        services: c.segment || '',
        status: c.active ? 'active' : 'inactive',
        followers: Number(c.followers) || 0,
        engagement: Number(c.engagement) || 0
    }));

    db.socialPosts = (postsRes.data || []).map(p => ({
        id: p.id,
        clientId: p.client_id,
        title: p.title,
        platform: p.type || '',
        date: p.date,
        status: p.status
    }));

    db.trafficCampaigns = (trafficRes.data || []).map(t => ({
        id: t.id,
        clientId: t.client_id,
        name: t.campaign_name,
        startDate: t.start_date,
        budget: Number(t.budget) || 0,
        spent: Number(t.spent) || 0,
        leads: Number(t.leads) || 0,
        notes: t.details || ''
    }));

    initDashboard();
}

// --- Elements ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const navItems = document.querySelectorAll('.crm-nav-item');
const views = document.querySelectorAll('.crm-view');
const pageTitle = document.getElementById('page-title');

// Modal Elements
const modalClient = document.getElementById('modal-client');
const modalTask = document.getElementById('modal-task');
const modalTraffic = document.getElementById('modal-traffic');
const btnNewClient = document.getElementById('btn-new-client');
const btnNewTask = document.getElementById('btn-new-task');
const btnNewTraffic = document.getElementById('btn-new-traffic');

// Delete Buttons
const btnDelClient = document.querySelector('.btn-delete-client');
const btnDelTask = document.querySelector('.btn-delete-task');
const btnDelTraffic = document.querySelector('.btn-delete-traffic');

// Selectors
const selectors = [
    document.getElementById('dashboard-client-selector'),
    document.getElementById('social-client-selector'),
    document.getElementById('traffic-client-selector')
];

// Close Modals
document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        modalClient.style.display = 'none';
        modalTask.style.display = 'none';
        modalTraffic.style.display = 'none';
    });
});

// --- Login Logic ---
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        loadDB();
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const btnSubmit = loginForm.querySelector('button[type="submit"]');

    btnSubmit.innerText = 'Entrando...';
    btnSubmit.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({
        email: user,
        password: pass,
    });

    btnSubmit.innerText = 'Entrar';
    btnSubmit.disabled = false;

    if (error) {
        loginError.style.display = 'block';
    } else {
        loginError.style.display = 'none';
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        await loadDB();
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    dashboardView.style.display = 'none';
    loginView.style.display = 'flex';
    document.getElementById('password').value = '';
    document.getElementById('username').value = '';
});

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        const sectionName = item.innerText.split(' ').slice(1).join(' ');
        pageTitle.innerText = item.innerText.includes("Visão Geral") ? "Visão Geral" : sectionName;

        const targetId = `view-${item.dataset.target}`;
        views.forEach(v => v.style.display = 'none');
        document.getElementById(targetId).style.display = 'block';
    });
});

// --- Initialization ---
function initDashboard() {
    populateSelectors();
    renderClientList();

    // Trigger Renders based on current selector states
    const currDash = document.getElementById('dashboard-client-selector').value;
    renderGlobalDashboard(currDash);

    const currSocial = document.getElementById('social-client-selector').value;
    renderKanban(currSocial);

    const currTraffic = document.getElementById('traffic-client-selector').value;
    renderTraffic(currTraffic);
}

function populateSelectors() {
    const taskClientSel = document.getElementById('task-client');
    taskClientSel.innerHTML = '';

    // Options definitions
    const dashboardOpt = '<option value="all">Visão Geral (Todos os Clientes)</option>';
    const socialOpt = '<option value="all">Ver todos (Todos Clientes)</option>';
    const trafficOpt = '<option value="none">Selecione o Cliente...</option>';

    selectors.forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        if (sel.id === 'dashboard-client-selector') sel.innerHTML = dashboardOpt;
        if (sel.id === 'social-client-selector') sel.innerHTML = socialOpt;
        if (sel.id === 'traffic-client-selector') sel.innerHTML = trafficOpt;

        db.clients.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        if (currentVal && currentVal !== "") sel.value = currentVal;
    });

    db.clients.forEach(c => {
        taskClientSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// Global listeners
document.getElementById('dashboard-client-selector').addEventListener('change', (e) => renderGlobalDashboard(e.target.value));
document.getElementById('social-client-selector').addEventListener('change', (e) => renderKanban(e.target.value));
document.getElementById('traffic-client-selector').addEventListener('change', (e) => renderTraffic(e.target.value));


// --- GLOBAL DASHBOARD (NEW METRICS & CHARTS) ---
let chartInstances = {};

function formatMoney(val) {
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderGlobalDashboard(clientId) {
    const statsGrid = document.getElementById('dashboard-stats-grid');
    const chartsArea = document.getElementById('dashboard-charts');
    if (!statsGrid) return;

    let isGlobal = (clientId === 'all');

    // Aggregations
    let targetClients = isGlobal ? db.clients : db.clients.filter(c => c.id === clientId);
    let targetPosts = isGlobal ? db.socialPosts : db.socialPosts.filter(p => p.clientId === clientId);
    let targetCamps = isGlobal ? db.trafficCampaigns : db.trafficCampaigns.filter(c => c.clientId === clientId);

    const activeClientsCount = db.clients.filter(c => c.status === 'active').length;
    const pendingTasks = targetPosts.filter(p => p.status !== 'done').length;
    const doneTasks = targetPosts.filter(p => p.status === 'done').length;

    const totalSpent = targetCamps.reduce((acc, c) => acc + Number(c.spent), 0);
    const totalLeads = targetCamps.reduce((acc, c) => acc + Number(c.leads), 0);
    const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0;

    let totalFollowers = targetClients.reduce((acc, c) => acc + Number(c.followers || 0), 0);
    let avgEng = targetClients.length ? (targetClients.reduce((acc, c) => acc + Number(c.engagement || 0), 0) / targetClients.length) : 0;

    // Render Stats
    if (isGlobal) {
        statsGrid.innerHTML = `
            <div class="stat-card"><h4>Clientes Ativos</h4><div class="number">${activeClientsCount}</div></div>
            <div class="stat-card"><h4>Total Posts (Pendentes/Concluídos)</h4><div class="number">${pendingTasks} / ${doneTasks}</div></div>
            <div class="stat-card"><h4>Investimento Total Tráfego</h4><div class="number">${formatMoney(totalSpent)}</div></div>
            <div class="stat-card"><h4>Audiência Potencial (Seguidores)</h4><div class="number">${totalFollowers.toLocaleString('pt-BR')}</div></div>
        `;
        chartsArea.style.display = 'none'; // Hide charts on global view for simplicity, or we could aggregate them
    } else {
        statsGrid.innerHTML = `
            <div class="stat-card"><h4>Seguidores</h4><div class="number">${totalFollowers.toLocaleString('pt-BR')}</div><span class="trend positive">Atualizado no mês</span></div>
            <div class="stat-card"><h4>Engajamento Médio</h4><div class="number">${avgEng.toFixed(1)}%</div></div>
            <div class="stat-card"><h4>Posts Publicados/Aprovados</h4><div class="number">${doneTasks}</div><span class="trend" style="color:var(--text-light); margin-top:8px; display:block;">+ ${pendingTasks} a produzir</span></div>
            <div class="stat-card"><h4>Investido em Tráfego</h4><div class="number">${formatMoney(totalSpent)}</div></div>
            <div class="stat-card"><h4>Leads Gerados</h4><div class="number">${totalLeads}</div></div>
            <div class="stat-card"><h4>CPL Médio</h4><div class="number">${formatMoney(avgCpl)}</div></div>
        `;
        chartsArea.style.display = 'flex';
        renderCharts(clientId, targetCamps);
    }
}

function renderCharts(clientId, campaigns) {
    if (!window.Chart) return; // Fail safe if CDN is blocked

    const ctxFollowers = document.getElementById('chartFollowers').getContext('2d');
    const ctxTraffic = document.getElementById('chartTraffic').getContext('2d');

    // Destroy existing to prevent hover glitch
    if (chartInstances['followers']) chartInstances['followers'].destroy();
    if (chartInstances['traffic']) chartInstances['traffic'].destroy();

    // Chart 1: Follower Growth (Mock Data based on current for demo)
    const client = db.clients.find(c => c.id === clientId);
    let currentFol = Number(client.followers) || 0;

    // Simulate past 3 months based on current
    const folData = [Math.floor(currentFol * 0.8), Math.floor(currentFol * 0.9), Math.floor(currentFol * 0.95), currentFol];

    chartInstances['followers'] = new Chart(ctxFollowers, {
        type: 'line',
        data: {
            labels: ['Mês -3', 'Mês -2', 'Mês Passado', 'Atual'],
            datasets: [{
                label: 'Seguidores',
                data: folData,
                borderColor: '#820AD1',
                backgroundColor: 'rgba(130, 10, 209, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Chart 2: Traffic Performance (Leads vs Spent per campaign)
    const campNames = campaigns.map(c => c.name.substring(0, 15) + '...');
    const campLeads = campaigns.map(c => Number(c.leads));

    if (campaigns.length === 0) {
        chartInstances['traffic'] = new Chart(ctxTraffic, { type: 'bar', data: { labels: ['Sem dados'], datasets: [{ data: [0] }] } });
        return;
    }

    chartInstances['traffic'] = new Chart(ctxTraffic, {
        type: 'bar',
        data: {
            labels: campNames,
            datasets: [{
                label: 'Leads Gerados',
                data: campLeads,
                backgroundColor: '#2ed573'
            }]
        },
        options: { responsive: true }
    });
}


// --- OTHER SECTIONS (CLIENT LIST, KANBAN, TRAFFIC) ---

function renderClientList() {
    const tbody = document.getElementById('client-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    db.clients.forEach(client => {
        const tr = document.createElement('tr');
        const statusClass = client.status === 'active' ? 'status-active' : 'status-inactive';
        const statusText = client.status === 'active' ? 'Ativo' : 'Inativo';

        tr.innerHTML = `
            <td>#${client.id}</td>
            <td style="font-weight: 500;">${client.name}</td>
            <td>${client.services}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-text btn-edit" data-id="${client.id}" style="font-size: 0.85rem; margin-right: 10px;">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const clientId = e.target.getAttribute('data-id');
            openEditClientModal(clientId);
        });
    });
}

function renderKanban(clientId) {
    const todo = document.getElementById('social-todo');
    const doing = document.getElementById('social-doing');
    const done = document.getElementById('social-done');
    if (!todo) return;

    todo.innerHTML = ''; doing.innerHTML = ''; done.innerHTML = '';

    let posts = db.socialPosts;
    if (clientId && clientId !== 'all') {
        posts = posts.filter(p => p.clientId === clientId);
    }

    posts.forEach(post => {
        const clientName = db.clients.find(c => c.id === post.clientId)?.name;
        const cardNode = document.createElement('div');
        cardNode.className = 'kanban-card';
        cardNode.setAttribute('draggable', 'true');
        cardNode.setAttribute('data-id', post.id);

        cardNode.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', post.id);
            setTimeout(() => cardNode.style.opacity = '0.5', 0);
        });
        cardNode.addEventListener('dragend', () => cardNode.style.opacity = '1');
        cardNode.addEventListener('click', () => openEditTaskModal(post.id));

        let displayDate = post.date;
        if (post.date && post.date.includes('-')) {
            const parts = post.date.split('-');
            displayDate = `${parts[2]}/${parts[1]}`;
        }

        cardNode.innerHTML = `
            <h5>${post.title}</h5>
            <div class="kanban-meta" style="margin-bottom: 8px;">
                <span style="font-size: 0.75rem; color: var(--primary-color)">${clientName}</span>
            </div>
            <div class="kanban-meta">
                <span class="tag">${post.platform}</span>
                <span style="font-weight: 500;">🗓 ${displayDate}</span>
            </div>
        `;

        if (post.status === 'todo') todo.appendChild(cardNode);
        if (post.status === 'doing') doing.appendChild(cardNode);
        if (post.status === 'done') done.appendChild(cardNode);
    });

    setupDropZone(document.getElementById('social-todo').parentElement, 'todo');
    setupDropZone(document.getElementById('social-doing').parentElement, 'doing');
    setupDropZone(document.getElementById('social-done').parentElement, 'done');
}

function setupDropZone(columnElement, newStatus) {
    columnElement.addEventListener('dragover', (e) => { e.preventDefault(); columnElement.style.backgroundColor = '#e1e5eb'; });
    columnElement.addEventListener('dragleave', (e) => { columnElement.style.backgroundColor = ''; });

    columnElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        columnElement.style.backgroundColor = '';
        const postId = e.dataTransfer.getData('text/plain');
        const postIdx = db.socialPosts.findIndex(p => p.id == postId);
        if (postIdx > -1 && db.socialPosts[postIdx].status !== newStatus) {
            db.socialPosts[postIdx].status = newStatus;
            const currSocialFiltered = document.getElementById('social-client-selector').value;
            renderKanban(currSocialFiltered);
            await supabase.from('posts').update({ status: newStatus }).eq('id', postId);
        }
    });
}

function renderTraffic(clientId) {
    const container = document.getElementById('traffic-metrics-container');
    const emptyState = document.getElementById('traffic-empty-state');
    const btnNewTraffic = document.getElementById('btn-new-traffic');

    if (!clientId || clientId === 'none') {
        container.style.display = 'none';
        btnNewTraffic.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.style.display = 'block';
    btnNewTraffic.style.display = 'block';

    const clientName = db.clients.find(c => c.id === clientId)?.name;
    document.getElementById('traffic-client-name').innerText = `Visão 360º: ${clientName}`;

    const campaigns = db.trafficCampaigns.filter(c => c.clientId === clientId);

    let totalBudget = 0, totalSpent = 0, totalLeads = 0;
    const tbody = document.getElementById('traffic-campaigns-body');
    tbody.innerHTML = '';

    if (campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhuma campanha cadastrada para este cliente.</td></tr>';
    } else {
        campaigns.forEach(camp => {
            const startDateArr = camp.startDate.split('-');
            const formattedDate = startDateArr.length === 3 ? `${startDateArr[2]}/${startDateArr[1]}/${startDateArr[0]}` : camp.startDate;
            const b = Number(camp.budget); const s = Number(camp.spent); const l = Number(camp.leads);
            totalBudget += b; totalSpent += s; totalLeads += l;

            const cpl = l > 0 ? (s / l) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 500;">${camp.name}</td>
                <td>${formattedDate}</td>
                <td>${formatMoney(b)}</td>
                <td>${formatMoney(s)}</td>
                <td>${l} <br><span style="font-size: 0.8rem; color: var(--text-light);">(CPL: ${formatMoney(cpl)})</span></td>
                <td style="font-size: 0.85rem; max-width: 200px; color: var(--text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${camp.notes}">${camp.notes || '-'}</td>
                <td><button class="btn-text btn-edit-traffic" data-id="${camp.id}" style="font-size: 0.85rem;">Editar</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.querySelectorAll('.btn-edit-traffic').forEach(btn => {
        btn.addEventListener('click', (e) => openEditTrafficModal(e.target.getAttribute('data-id')));
    });

    const avgCPL = totalLeads > 0 ? (totalSpent / totalLeads) : 0;
    document.getElementById('tr-total-budget').innerText = formatMoney(totalBudget);
    document.getElementById('tr-total-spent').innerText = formatMoney(totalSpent);
    document.getElementById('tr-total-leads').innerText = totalLeads;
    document.getElementById('tr-avg-cpl').innerText = formatMoney(avgCPL);
}

// --- CRUD Actions ---

// Form: Client
const formClient = document.getElementById('form-client');
btnNewClient.addEventListener('click', () => {
    document.getElementById('modal-client-title').innerText = "Novo Cliente";
    formClient.reset();
    document.getElementById('client-id').value = '';
    btnDelClient.style.display = 'none';
    modalClient.style.display = 'flex';
});

function openEditClientModal(id) {
    const client = db.clients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('modal-client-title').innerText = "Editar Cliente";
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-services').value = client.services;
    document.getElementById('client-followers').value = client.followers || 0;
    document.getElementById('client-engagement').value = client.engagement || 0.0;
    document.getElementById('client-status').value = client.status;

    btnDelClient.style.display = 'block';
    btnDelClient.onclick = async () => {
        if (confirm("Tem certeza que deseja excluir este cliente? Suas tarefas e métricas também serão perdidas.")) {
            // Optimistic update locally
            db.clients = db.clients.filter(c => c.id !== id);
            db.socialPosts = db.socialPosts.filter(p => p.clientId !== id);
            db.trafficCampaigns = db.trafficCampaigns.filter(t => t.clientId !== id);
            modalClient.style.display = 'none';
            initDashboard(); // re-render fast
            await supabase.from('clients').delete().eq('id', id);
        }
    };

    modalClient.style.display = 'flex';
}

formClient.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idField = document.getElementById('client-id').value;
    const btnSubmit = formClient.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerText;
    btnSubmit.innerText = 'Salvando...';
    btnSubmit.disabled = true;

    const clientData = {
        name: document.getElementById('client-name').value,
        segment: document.getElementById('client-services').value,
        active: document.getElementById('client-status').value === 'active',
        followers: Number(document.getElementById('client-followers').value),
        engagement: Number(document.getElementById('client-engagement').value)
    };

    if (idField) {
        await supabase.from('clients').update(clientData).eq('id', idField);
    } else {
        await supabase.from('clients').insert([clientData]);
    }

    btnSubmit.innerText = originalText;
    btnSubmit.disabled = false;
    modalClient.style.display = 'none';
    await loadDB();
});

// Form: Task (Social Media)
const formTask = document.getElementById('form-task');
btnNewTask.addEventListener('click', () => {
    formTask.reset();
    document.getElementById('form-task').removeAttribute('data-edit-id');
    btnDelTask.style.display = 'none';

    const currSocialFiltered = document.getElementById('social-client-selector').value;
    if (currSocialFiltered !== 'all') {
        document.getElementById('task-client').value = currSocialFiltered;
    } else if (db.clients.length > 0) {
        document.getElementById('task-client').value = db.clients[0].id;
    }
    modalTask.style.display = 'flex';
});

function openEditTaskModal(id) {
    const post = db.socialPosts.find(p => p.id == id);
    if (!post) return;

    document.getElementById('form-task').setAttribute('data-edit-id', post.id);
    document.getElementById('task-client').value = post.clientId;
    document.getElementById('task-title').value = post.title;
    document.getElementById('task-platform').value = post.platform;
    document.getElementById('task-date').value = post.date;
    document.getElementById('task-status').value = post.status;

    btnDelTask.style.display = 'block';
    btnDelTask.onclick = async () => {
        if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
            await supabase.from('posts').delete().eq('id', id);
            modalTask.style.display = 'none';
            await loadDB();
        }
    };

    modalTask.style.display = 'flex';
}

formTask.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('form-task').getAttribute('data-edit-id');
    const btnSubmit = formTask.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerText;
    btnSubmit.innerText = 'Salvando...';
    btnSubmit.disabled = true;

    const taskData = {
        client_id: document.getElementById('task-client').value,
        title: document.getElementById('task-title').value,
        type: document.getElementById('task-platform').value,
        date: document.getElementById('task-date').value,
        status: document.getElementById('task-status').value
    };

    if (editId) {
        await supabase.from('posts').update(taskData).eq('id', editId);
    } else {
        await supabase.from('posts').insert([taskData]);
    }

    btnSubmit.innerText = originalText;
    btnSubmit.disabled = false;
    modalTask.style.display = 'none';
    await loadDB();
});

// Form: Traffic Campaign
const formTraffic = document.getElementById('form-traffic');
btnNewTraffic.addEventListener('click', () => {
    formTraffic.reset();
    document.getElementById('traffic-id').value = '';
    document.getElementById('modal-traffic-title').innerText = "Nova Campanha de Tráfego";
    btnDelTraffic.style.display = 'none';
    modalTraffic.style.display = 'flex';
});

function openEditTrafficModal(id) {
    const camp = db.trafficCampaigns.find(c => c.id == id);
    if (!camp) return;

    document.getElementById('modal-traffic-title').innerText = "Editar Campanha";
    document.getElementById('traffic-id').value = camp.id;
    document.getElementById('traffic-name').value = camp.name;
    document.getElementById('traffic-start').value = camp.startDate;
    document.getElementById('traffic-budget').value = camp.budget;
    document.getElementById('traffic-spent').value = camp.spent;
    document.getElementById('traffic-leads').value = camp.leads;
    document.getElementById('traffic-notes').value = camp.notes || "";

    btnDelTraffic.style.display = 'block';
    btnDelTraffic.onclick = async () => {
        if (confirm("Tem certeza que deseja excluir esta campanha?")) {
            await supabase.from('traffic').delete().eq('id', id);
            modalTraffic.style.display = 'none';
            await loadDB();
        }
    };

    modalTraffic.style.display = 'flex';
}

formTraffic.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idField = document.getElementById('traffic-id').value;
    const currentClientId = document.getElementById('traffic-client-selector').value;
    const btnSubmit = formTraffic.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerText;
    btnSubmit.innerText = 'Salvando...';
    btnSubmit.disabled = true;

    const campData = {
        campaign_name: document.getElementById('traffic-name').value,
        start_date: document.getElementById('traffic-start').value,
        budget: Number(document.getElementById('traffic-budget').value),
        spent: Number(document.getElementById('traffic-spent').value),
        leads: Number(document.getElementById('traffic-leads').value),
        details: document.getElementById('traffic-notes').value
    };

    if (idField) {
        await supabase.from('traffic').update(campData).eq('id', idField);
    } else {
        campData.client_id = currentClientId;
        await supabase.from('traffic').insert([campData]);
    }

    btnSubmit.innerText = originalText;
    btnSubmit.disabled = false;
    modalTraffic.style.display = 'none';
    await loadDB();
});
