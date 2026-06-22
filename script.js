/**
 * Night Crows Dashboard - Core Logic File (Tax Aware, Efficiency & Items Tracking)
 */

// --- 1. REGRAS DE NEGÓCIO E CONSTANTES GLOBAIS ---
const DIAMOND_TO_BRL_RATE = 20 / 1000; // Cotação: 1000 diamantes = R$20

// Geração automatizada da lista fixa dos 27 personagens obrigatórios
const CHARACTERS = [
    ...Array.from({length: 10}, (_, i) => ({ id: `K${String(i+1).padStart(2, '0')}`, server: 'SA102 - Knight' })),
    ...Array.from({length: 17}, (_, i) => ({ id: `R${String(i+1).padStart(2, '0')}`, server: 'SA101 - Rook' }))
];

// Estrutura de dados padrão do banco local (LocalStorage)
let db = {
    goal: 500,
    records: []
};

let chartInstance = null;

// Helper Global para Formatação de Moeda no Padrão Brasileiro
const formatBRL = (valor) => {
    return (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper para cálculo de Taxas do Jogo (Taxa única de 5% de mercado na venda)
function getNetDiamonds(grossDiamonds) {
    return grossDiamonds * 0.95;
}

// --- 2. GERENCIADOR DE INICIALIZAÇÃO ---
function init() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('viewMonth').value = currentMonth;
    document.getElementById('inputMonth').value = currentMonth;
    document.getElementById('avulsoMonth').value = currentMonth;

    loadDB();
    populateCharDropdowns();
    setupEventListeners();
    updateDashboard();
}

function loadDB() {
    const stored = localStorage.getItem('nightCrowsDB');
    if (stored) {
        db = JSON.parse(stored);
    } else {
        saveDB(); 
    }
    document.getElementById('monthlyGoalInput').value = db.goal || 500;
}

function saveDB() {
    localStorage.setItem('nightCrowsDB', JSON.stringify(db));
}

function populateCharDropdowns() {
    const selects = ['inputChar', 'avulsoChar'];
    const optionsHtml = `
        <optgroup label="Conta Principal">
            <option value="FRK96">FRK96 (Main Account)</option>
        </optgroup>
        <optgroup label="Secundárias (SA102)">
            ${CHARACTERS.filter(c => c.server.includes('102')).map(c => `<option value="${c.id}">${c.id}</option>`).join('')}
        </optgroup>
        <optgroup label="Secundárias (SA101)">
            ${CHARACTERS.filter(c => c.server.includes('101')).map(c => `<option value="${c.id}">${c.id}</option>`).join('')}
        </optgroup>
    `;
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = optionsHtml;
    });
}

function setupEventListeners() {
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('btnExport').addEventListener('click', exportData);
    document.getElementById('viewMonth').addEventListener('change', updateDashboard);
    document.getElementById('monthlyGoalInput').addEventListener('change', (e) => updateGoal(e.target.value));
    document.getElementById('formMorions').addEventListener('submit', saveMorionRecord);
    document.getElementById('formAvulso').addEventListener('submit', saveAvulsoRecord);
}

// --- 3. OPERAÇÕES DE LANÇAMENTO ---
function saveMorionRecord(e) {
    e.preventDefault();
    const bruto = parseInt(document.getElementById('inputMorionDia').value) || 0;
    // Cálculo: 5% de taxa, arredondado para baixo
    const valorLiquido = Math.floor(bruto * 0.95);

    const record = {
        id: Date.now().toString(),
        type: 'morion',
        month: document.getElementById('inputMonth').value,
        week: parseInt(document.getElementById('inputWeek').value),
        charId: document.getElementById('inputChar').value,
        morions: parseInt(document.getElementById('inputMorionQtd').value) || 0,
        diamonds: valorLiquido, // Salva o valor já tributado
        hours: parseFloat(document.getElementById('inputHours').value) || 0,
        timestamp: Date.now()
    };
    db.records.push(record);
    saveDB();
    e.target.reset();
    document.getElementById('inputMonth').value = record.month; 
    updateDashboard();
}

function saveAvulsoRecord(e) {
    e.preventDefault();
    const bruto = parseInt(document.getElementById('avulsoDia').value) || 0;
    // Cálculo: 5% de taxa, arredondado para baixo
    const valorLiquido = Math.floor(bruto * 0.95);

    const record = {
        id: Date.now().toString(),
        type: 'avulso',
        month: document.getElementById('avulsoMonth').value,
        week: parseInt(document.getElementById('avulsoWeek').value),
        charId: document.getElementById('avulsoChar').value,
        itemName: document.getElementById('avulsoItemName').value || 'Item Avulso',
        morions: 0,
        diamonds: valorLiquido, // Salva o valor já tributado
        hours: 0,
        timestamp: Date.now()
    };
    db.records.push(record);
    saveDB();
    e.target.reset();
    document.getElementById('avulsoMonth').value = record.month; 
    updateDashboard();
}

function updateGoal(val) {
    db.goal = parseFloat(val) || 0;
    saveDB();
    updateDashboard();
}

// Exclusão Global de Registros
window.deleteRecord = function(id) {
    if(confirm("Tem certeza que deseja excluir este registro?")) {
        db.records = db.records.filter(r => r.id !== id);
        saveDB();
        updateDashboard();
    }
};

// --- 4. FLUXO DE SINCRONIZAÇÃO DA INTERFACE ---
function updateDashboard() {
    const viewMonth = document.getElementById('viewMonth').value; 
    if(!viewMonth) return;

    const monthlyRecords = db.records.filter(r => r.month === viewMonth);
    
    let totalMorions = 0;
    let totalDiamonds = 0; 
    let totalNetDiamonds = 0; 

    monthlyRecords.forEach(r => {
        totalMorions += r.morions;
        totalDiamonds += r.diamonds;
        totalNetDiamonds += getNetDiamonds(r.diamonds, r.charId);
    });

    const totalBrl = totalNetDiamonds * DIAMOND_TO_BRL_RATE;

    document.getElementById('cardTotalDiamonds').innerText = totalDiamonds.toLocaleString('pt-BR');
    document.getElementById('cardTotalMorions').innerText = totalMorions.toLocaleString('pt-BR');
    document.getElementById('cardTotalBrl').innerText = formatBRL(totalBrl);

    const goal = db.goal || 1;
    const progressPct = Math.min((totalBrl / goal) * 100, 100).toFixed(1);
    const missing = Math.max(goal - totalBrl, 0);
    
    document.getElementById('goalProgressBar').style.width = `${progressPct}%`;
    document.getElementById('goalProgressText').innerText = `R$ ${formatBRL(totalBrl)} atingido (Falta R$ ${formatBRL(missing)})`;

    renderTable(viewMonth, monthlyRecords);
    renderMainAccount(monthlyRecords);
    renderAvulsosTable(monthlyRecords);
    renderEfficiency(monthlyRecords);
    renderComparisons(viewMonth);
    renderForecasting(viewMonth);
    renderChart();
}

// --- 5. RENDERIZADORES DE COMPONENTES ---
function renderTable(month, records) {
    const tbody = document.getElementById('tableMorionsBody');
    if (!tbody) return;
    let html = '';

    CHARACTERS.forEach(char => {
        let rowTotal = 0;
        let weeksHtml = '';
        
        for(let w = 1; w <= 5; w++) {
            const wRecords = records.filter(r => r.charId === char.id && r.week === w && r.type === 'morion');
            const wSum = wRecords.reduce((acc, curr) => acc + curr.morions, 0);
            rowTotal += wSum;
            weeksHtml += `<td>${wSum > 0 ? wSum.toLocaleString('pt-BR') : '-'}</td>`;
        }

        html += `
            <tr>
                <td class="text-start ps-4 py-2 text-muted fw-bold">${char.id}</td>
                <td style="font-size: 0.75rem" class="text-muted">${char.server}</td>
                ${weeksHtml}
                <td class="fw-bold bg-dark text-white">${rowTotal > 0 ? rowTotal.toLocaleString('pt-BR') : '-'}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}
function renderMainAccount(records) {
    let totalMorions = 0;
    
    // Loop das 5 semanas
    for(let w = 1; w <= 5; w++) {
        const wRecords = records.filter(r => r.charId === 'FRK96' && r.week === w);
        
        // Somamos APENAS os Morions
        const morionsSum = wRecords.filter(r => r.type === 'morion').reduce((acc, curr) => acc + curr.morions, 0);
        
        // Exibição: Se tem morion, mostra o valor, senão mostra '-'
        const element = document.getElementById(`mainS${w}`);
        if(element) element.innerText = morionsSum > 0 ? `${morionsSum}` : '-';
        
        totalMorions += morionsSum;
    }

    // O total acumulado (em R$) continua usando o valor tributado dos diamantes
    const allMainRecords = records.filter(r => r.charId === 'FRK96');
    const totalNetDiamondsMain = allMainRecords.reduce((acc, r) => acc + r.diamonds, 0);
    const totalBrl = totalNetDiamondsMain * DIAMOND_TO_BRL_RATE;

    const elMorions = document.getElementById('mainTotalMorions');
    const elBrl = document.getElementById('mainTotalBrl');
    
    if(elMorions) elMorions.innerText = totalMorions.toLocaleString('pt-BR');
    if(elBrl) elBrl.innerText = `R$ ${formatBRL(totalBrl)}`; 
}
// --- CORREÇÃO: Aplicação do imposto ANTES de salvar no banco ---

function saveMorionRecord(e) {
    e.preventDefault();
    const bruto = parseInt(document.getElementById('inputMorionDia').value) || 0;
    
    const record = {
        id: Date.now().toString(),
        type: 'morion',
        month: document.getElementById('inputMonth').value,
        week: parseInt(document.getElementById('inputWeek').value),
        charId: document.getElementById('inputChar').value,
        morions: parseInt(document.getElementById('inputMorionQtd').value) || 0,
        // SALVA O LÍQUIDO NO BANCO
        diamonds: getNetDiamonds(bruto), 
        // Armazenamos o bruto separadamente apenas se precisar exibir depois
        diamondsBruto: bruto, 
        hours: parseFloat(document.getElementById('inputHours').value) || 0,
        timestamp: Date.now()
    };
    db.records.push(record);
    saveDB();
    e.target.reset();
    document.getElementById('inputMonth').value = record.month; 
    updateDashboard();
}

function saveAvulsoRecord(e) {
    e.preventDefault();
    const bruto = parseInt(document.getElementById('avulsoDia').value) || 0;

    const record = {
        id: Date.now().toString(),
        type: 'avulso',
        month: document.getElementById('avulsoMonth').value,
        week: parseInt(document.getElementById('avulsoWeek').value),
        charId: document.getElementById('avulsoChar').value,
        itemName: document.getElementById('avulsoItemName').value || 'Item Avulso',
        morions: 0,
        // SALVA O LÍQUIDO NO BANCO
        diamonds: getNetDiamonds(bruto),
        diamondsBruto: bruto,
        hours: 0,
        timestamp: Date.now()
    };
    db.records.push(record);
    saveDB();
    e.target.reset();
    document.getElementById('avulsoMonth').value = record.month; 
    updateDashboard();
}

function renderAvulsosTable(records) {
    const tbody = document.getElementById('tableAvulsosBody');
    if (!tbody) return;
    
    let html = '';
    records.filter(r => r.type === 'avulso').forEach(r => {
        // 1. O valor tributado (5%) arredondado para baixo
        const bruto = (r.diamondsBruto || r.diamonds);
        const liquido = Math.floor(bruto * 0.95);
        
        // 2. O valor em R$ baseado estritamente no líquido
        const netBrl = liquido * DIAMOND_TO_BRL_RATE;
        
        html += `
            <tr>
                <td class="text-start ps-4 py-2 fw-bold text-muted">${r.charId}</td>
                <td class="py-2">Semana ${r.week}</td>
                <td class="py-2 text-start text-white">${r.itemName || 'Item Avulso'}</td>
                <td class="py-2 text-info fw-bold">${liquido.toLocaleString('pt-BR')}</td>
                <td class="py-2 text-success fw-bold">R$ ${formatBRL(netBrl)}</td>
                <td class="py-2">
                    <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="deleteRecord('${r.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html || `<tr><td colspan="6" class="py-3 text-muted">Nenhum item avulso lançado.</td></tr>`;
}

function renderEfficiency(records) {
    const tbody = document.getElementById('tableEfficiencyBody');
    if (!tbody) return;

    let charStats = {};
    
    records.forEach(r => {
        if (r.type === 'morion' && r.hours && r.hours > 0) { 
            if (!charStats[r.charId]) {
                charStats[r.charId] = { hours: 0, morions: 0, diamonds: 0 };
            }
            charStats[r.charId].hours += r.hours;
            charStats[r.charId].morions += r.morions;
            charStats[r.charId].diamonds += r.diamonds;
        }
    });

    let efficiencyData = Object.keys(charStats).map(charId => {
        let stat = charStats[charId];
        return {
            charId: charId,
            hours: stat.hours,
            mh: stat.morions / stat.hours,
            dh: stat.diamonds / stat.hours
        };
    }).sort((a, b) => b.mh - a.mh); 

    let html = '';
    efficiencyData.forEach(data => {
        html += `
            <tr>
                <td class="text-start ps-4 py-2 fw-bold text-muted">${data.charId}</td>
                <td class="py-2">${data.hours}h</td>
                <td class="py-2 text-info fw-bold">${data.mh.toFixed(2)}</td>
                <td class="py-2 text-success fw-bold">${data.dh.toFixed(2)}</td>
            </tr>
        `;
    });

    if(efficiencyData.length === 0) {
        html = `<tr><td colspan="4" class="py-3 text-muted">Lance as horas de farm no formulário para gerar o ranking de eficiência.</td></tr>`;
    }

    tbody.innerHTML = html;
}

function renderComparisons(viewMonth) {
    const getWeekBrl = (monthStr, weekNum) => {
        return db.records
            .filter(r => r.month === monthStr && r.week === weekNum)
            .reduce((acc, r) => acc + (getNetDiamonds(r.diamonds, r.charId) * DIAMOND_TO_BRL_RATE), 0);
    };

    let lastActiveWeek = 0;
    for(let w = 5; w >= 1; w--) {
        if(getWeekBrl(viewMonth, w) > 0) { lastActiveWeek = w; break; }
    }

    const wowEl = document.getElementById('compWoW');
    if (wowEl) {
        if (lastActiveWeek > 1) {
            const currentW = getWeekBrl(viewMonth, lastActiveWeek);
            const prevW = getWeekBrl(viewMonth, lastActiveWeek - 1);
            if (prevW > 0) {
                const varPct = ((currentW - prevW) / prevW) * 100;
                wowEl.innerHTML = formatVariation(varPct) + ` <span class="fs-6 text-muted">(S${lastActiveWeek} vs S${lastActiveWeek-1})</span>`;
            } else { wowEl.innerText = "S/ Dados Ant."; }
        } else { wowEl.innerText = "-"; }
    }

    const momEl = document.getElementById('compMoM');
    if (momEl) {
        const [year, mth] = viewMonth.split('-');
        let prevMonthDate = new Date(year, parseInt(mth) - 2, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (lastActiveWeek > 0) {
            const currMBrl = getWeekBrl(viewMonth, lastActiveWeek);
            const prevMBrl = getWeekBrl(prevMonthStr, lastActiveWeek);
            if (prevMBrl > 0) {
                const varPct = ((currMBrl - prevMBrl) / prevMBrl) * 100;
                momEl.innerHTML = formatVariation(varPct) + ` <span class="fs-6 text-muted">(S${lastActiveWeek} ${mth} vs S${lastActiveWeek} ${String(prevMonthDate.getMonth()+1).padStart(2,'0')})</span>`;
            } else { momEl.innerText = "S/ Dados Ant."; }
        } else { momEl.innerText = "-"; }
    }
}

function formatVariation(value) {
    if (value > 0) return `<span class="text-success">▲ +${value.toFixed(1)}%</span>`;
    if (value < 0) return `<span class="text-danger">▼ ${value.toFixed(1)}%</span>`;
    return `<span class="text-muted">0%</span>`;
}

function renderForecasting(viewMonth) {
    let timeline = {};
    db.records.forEach(r => {
        const key = `${r.month}-W${r.week}`;
        if(!timeline[key]) timeline[key] = { morions: 0, brl: 0, rawDate: `${r.month}-0${r.week}` };
        timeline[key].morions += r.morions;
        timeline[key].brl += (getNetDiamonds(r.diamonds, r.charId) * DIAMOND_TO_BRL_RATE);
    });

    const sortedKeys = Object.keys(timeline).sort((a, b) => timeline[a].rawDate.localeCompare(timeline[b].rawDate));
    const last3Keys = sortedKeys.slice(-3);
    
    if(last3Keys.length === 0) {
        document.getElementById('fcNextWeekMorions').innerText = "Sem dados";
        document.getElementById('fcNextWeekBrl').innerText = "Sem dados";
        document.getElementById('fcEndOfMonthBrl').innerText = "Sem dados";
        return;
    }

    let sumMorions = 0;
    let sumBrl = 0;
    last3Keys.forEach(k => {
        sumMorions += timeline[k].morions;
        sumBrl += timeline[k].brl;
    });

    const avgMorions = sumMorions / last3Keys.length;
    const avgBrl = sumBrl / last3Keys.length;

    document.getElementById('fcNextWeekMorions').innerText = `~ ${Math.round(avgMorions).toLocaleString('pt-BR')} Morions`;
    document.getElementById('fcNextWeekBrl').innerText = `~ R$ ${formatBRL(avgBrl)}`;

    const monthlyRecords = db.records.filter(r => r.month === viewMonth);
    const currentMonthBrl = monthlyRecords.reduce((acc, r) => acc + (getNetDiamonds(r.diamonds, r.charId) * DIAMOND_TO_BRL_RATE), 0);
    
    let lastActiveWeek = 0;
    for(let w = 5; w >= 1; w--) {
        if(monthlyRecords.some(r => r.week === w)) { lastActiveWeek = w; break; }
    }

    const missingWeeks = Math.max(5 - lastActiveWeek, 0);
    const eomProjection = currentMonthBrl + (missingWeeks * avgBrl);

    document.getElementById('fcEndOfMonthBrl').innerText = `~ R$ ${formatBRL(eomProjection)} (${missingWeeks} sem. restantes)`;
}

function renderChart() {
    let timeline = {};
    db.records.forEach(r => {
        const key = `${r.month} S${r.week}`;
        if(!timeline[key]) timeline[key] = { brl: 0, morions: 0, sortKey: `${r.month}-0${r.week}` };
        timeline[key].morions += r.morions;
        timeline[key].brl += (getNetDiamonds(r.diamonds, r.charId) * DIAMOND_TO_BRL_RATE);
    });

    const sortedKeys = Object.keys(timeline).sort((a, b) => timeline[a].sortKey.localeCompare(timeline[b].sortKey)).slice(-10);
    
    const labels = sortedKeys;
    const dataBrl = sortedKeys.map(k => timeline[k].brl);
    const dataMorions = sortedKeys.map(k => timeline[k].morions);

    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ganhos Líquidos (R$)',
                    data: dataBrl,
                    borderColor: '#a67c52',
                    backgroundColor: 'rgba(166, 124, 82, 0.05)',
                    borderWidth: 2,
                    tension: 0.2,
                    yAxisID: 'y'
                },
                {
                    label: 'Drop de Morions',
                    data: dataMorions,
                    type: 'bar',
                    backgroundColor: '#38302a',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#8b8178', font: { family: 'Noto Sans' } } }
            },
            scales: {
                x: { ticks: { color: '#8b8178' }, grid: { color: 'rgba(56, 48, 42, 0.3)' } },
                y: { 
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: 'Reais (R$)', color: '#8b8178' },
                    ticks: { color: '#8b8178' }, grid: { color: 'rgba(56, 48, 42, 0.3)' }
                },
                y1: { 
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Morions', color: '#8b8178' },
                    ticks: { color: '#8b8178' }, grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// --- 6. SEGURANÇA E BACKUP (EXPORTAÇÃO/IMPORTAÇÃO MESCLADA) ---
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `nightcrows_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if(imported.records && Array.isArray(imported.records)) {
                
                if (imported.goal) {
                    db.goal = imported.goal;
                }

                imported.records.forEach(newRecord => {
                    const existingIndex = db.records.findIndex(r => 
                        r.charId === newRecord.charId && 
                        r.month === newRecord.month && 
                        r.week === newRecord.week && 
                        r.type === newRecord.type
                    );

                    if (existingIndex !== -1) {
                        db.records[existingIndex] = newRecord;
                    } else {
                        db.records.push(newRecord);
                    }
                });

                saveDB();
                updateDashboard();
                alert("Dados mesclados e salvos com sucesso! O histórico foi totalmente atualizado.");
            } else {
                alert("Arquivo inválido. A estrutura do JSON está incorreta.");
            }
        } catch (error) {
            alert("Erro ao processar o arquivo JSON.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

document.addEventListener('DOMContentLoaded', init);    