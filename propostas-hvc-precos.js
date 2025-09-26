/* Estilos específicos para preços das propostas HVC */

.section-title {
    margin-top: 20px;
    margin-bottom: 15px;
    color: #f8f9fa;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 8px;
}

#secao-precos {
    background-color: rgba(0, 123, 255, 0.1);
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
    border: 1px solid rgba(0, 123, 255, 0.2);
}

#btn-calcular-precos {
    margin-top: 10px;
}

/* Campos de preço */
#preco-total, #preco-mao-obra, #preco-material {
    font-weight: bold;
    text-align: right;
}

/* Campos readonly */
input[readonly] {
    background-color: rgba(200, 200, 200, 0.2);
    cursor: not-allowed;
}

/* Animação quando o preço é calculado */
@keyframes highlight-price {
    0% { background-color: rgba(40, 167, 69, 0.3); }
    100% { background-color: transparent; }
}

.price-calculated {
    animation: highlight-price 1.5s ease-out;
}

/* ===== ESTILOS PARA LOCAIS DE APLICAÇÃO ===== */

/* Modal de Locais */
#modal-locais .modal-content {
    max-width: 800px;
    width: 90%;
}

/* Seção de Locais */
.locais-section {
    margin-bottom: 2rem;
}

/* Tabela de Locais */
.locais-table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.locais-table th,
.locais-table td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid rgba(173, 216, 230, 0.2);
}

.locais-table th {
    background: rgba(173, 216, 230, 0.1);
    font-weight: 600;
    color: #add8e6;
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 0.5px;
}

.locais-table td {
    color: #e0e0e0;
}

.locais-table tr:hover {
    background: rgba(173, 216, 230, 0.05);
}

/* Formulário de Local */
.local-form-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 1.5rem;
    border: 1px solid rgba(173, 216, 230, 0.2);
    margin-top: 1rem;
}

.local-form-section.hidden {
    display: none;
}

/* Botões de ação para locais */
.btn-edit-local,
.btn-delete-local {
    padding: 6px 12px;
    margin: 0 2px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.3s ease;
}

.btn-edit-local {
    background: linear-gradient(135deg, #ffc107, #e0a800);
    color: #000;
}

.btn-edit-local:hover {
    background: linear-gradient(135deg, #e0a800, #d39e00);
    transform: translateY(-1px);
}

.btn-delete-local {
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: white;
}

.btn-delete-local:hover {
    background: linear-gradient(135deg, #c82333, #bd2130);
    transform: translateY(-1px);
}

/* Campo de seleção de local no modal de serviço */
#servico-local {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(173, 216, 230, 0.3);
    border-radius: 8px;
    padding: 12px;
    color: #e0e0e0;
    font-size: 1rem;
    cursor: pointer;
}

#servico-local:focus {
    outline: none;
    border-color: #add8e6;
    box-shadow: 0 0 10px rgba(173, 216, 230, 0.3);
}

/* Botão de gerenciar locais */
#btn-gerenciar-locais {
    background: linear-gradient(135deg, #6c757d, #5a6268);
    color: white;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.3s ease;
    min-width: 50px;
}

#btn-gerenciar-locais:hover {
    background: linear-gradient(135deg, #5a6268, #495057);
    transform: translateY(-1px);
}

/* Coluna Local na tabela de serviços */
.services-table th:nth-child(2),
.services-table td:nth-child(2) {
    min-width: 120px;
    max-width: 150px;
    word-wrap: break-word;
}

/* Responsividade para locais */
@media (max-width: 768px) {
    #modal-locais .modal-content {
        width: 95%;
        margin: 10px;
    }
    
    .locais-table {
        font-size: 0.9rem;
    }
    
    .locais-table th,
    .locais-table td {
        padding: 8px 10px;
    }
    
    .btn-edit-local,
    .btn-delete-local {
        padding: 4px 8px;
        font-size: 0.7rem;
    }
    
    /* Esconder coluna de descrição em telas pequenas */
    .locais-table th:nth-child(2),
    .locais-table td:nth-child(2) {
        display: none;
    }
}

/* Animações para locais */
.local-row-enter {
    animation: slideInFromTop 0.3s ease-out;
}

@keyframes slideInFromTop {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.local-row-exit {
    animation: slideOutToTop 0.3s ease-in;
}

@keyframes slideOutToTop {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(-20px);
    }
}
