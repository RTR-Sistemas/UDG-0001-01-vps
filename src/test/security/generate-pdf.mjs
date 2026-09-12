import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, createWriteStream } from 'fs';
import path from 'path';

const __dirname = path.resolve();
const outputPdfPath = path.join(__dirname, 'security_architecture_pq.pdf');
const mdFilePath = path.join(__dirname, 'src', 'test', 'security', 'security_architecture_pq.md');
const compliancePath = path.join(__dirname, 'src', 'test', 'security', 'compliance_report.md');
const testReportPath = path.join(__dirname, 'test-report.md');

console.log('📄 Iniciando compilação do PDF da Arquitetura de Segurança Pós-Quântica...');

// Função para garantir que o pdfkit está instalado localmente
function ensurePdfKit() {
    try {
        // Verifica se consegue importar
        execSync('node -e "require(\'pdfkit\')"', { stdio: 'ignore' });
        console.log('✅ Biblioteca pdfkit já está instalada.');
    } catch {
        console.log('📦 pdfkit não encontrado. Instalando temporariamente...');
        try {
            execSync('npm install --no-save pdfkit', { stdio: 'inherit', cwd: __dirname });
            console.log('✅ Biblioteca pdfkit instalada com sucesso.');
        } catch (err) {
            console.error('❌ Falha ao instalar pdfkit. Certifique-se de que possui conexão com a internet e npm configurado.', err);
            process.exit(1);
        }
    }
}

async function generatePdf() {
    ensurePdfKit();
    const PDFDocument = (await import('pdfkit')).default;

    if (!existsSync(mdFilePath)) {
        console.error(`❌ Erro: Arquivo de arquitetura não encontrado em ${mdFilePath}`);
        process.exit(1);
    }

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    const stream = doc.pipe(createWriteStream(outputPdfPath));

    // Configuração de Estilos e Fontes do PDF
    doc.info['Title'] = 'Arquitetura de Segurança Pós-Quântica - UndoinG';
    doc.info['Author'] = 'Arquiteto de Sistemas e Especialista em Segurança';

    // Capa do PDF
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a'); // Fundo escuro premium (slate-900)
    doc.fillColor('#ef4444').fontSize(28).font('Helvetica-Bold').text('UndoinG', 50, 220, { align: 'center' });
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Suíte de Segurança e Arquitetura Pós-Quântica', 50, 270, { align: 'center' });
    doc.fillColor('#94a3b8').fontSize(12).font('Helvetica').text('Plano de Criptografia Total e Segurança contra Computação Quântica', 50, 310, { align: 'center' });
    doc.rect(150, 350, doc.page.width - 300, 3).fill('#ef4444');
    doc.fillColor('#94a3b8').fontSize(10).font('Helvetica-Oblique').text('Especificação de Engenharia e Relatório de Conformidade', 50, doc.page.height - 100, { align: 'center' });
    doc.fillColor('#64748b').text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 50, doc.page.height - 80, { align: 'center' });

    // Segunda página - Conteúdo da Arquitetura
    doc.addPage({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff'); // Fundo branco para leitura
    
    // Título Principal
    doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('1. Arquitetura de Segurança Pós-Quântica', 50, 50);
    doc.moveDown(1);

    const archMd = readFileSync(mdFilePath, 'utf8');
    const compMd = readFileSync(compliancePath, 'utf8');
    const testReportMd = existsSync(testReportPath) ? readFileSync(testReportPath, 'utf8') : '';

    // Função auxiliar simples para renderizar texto MD básico no PDFKit
    function renderMarkdownToPdf(pdfDoc, mdText) {
        const lines = mdText.split('\n');
        pdfDoc.fillColor('#334155').fontSize(10).font('Helvetica');

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('# ')) {
                pdfDoc.moveDown(1.5);
                pdfDoc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(line.replace('# ', ''));
                pdfDoc.moveDown(0.5);
            } else if (line.startsWith('## ')) {
                pdfDoc.moveDown(1.2);
                pdfDoc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text(line.replace('## ', ''));
                pdfDoc.moveDown(0.4);
            } else if (line.startsWith('### ')) {
                pdfDoc.moveDown(1);
                pdfDoc.fillColor('#334155').fontSize(11).font('Helvetica-Bold').text(line.replace('### ', ''));
                pdfDoc.moveDown(0.3);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                pdfDoc.fillColor('#334155').fontSize(10).font('Helvetica').text(`  •  ${line.substring(2)}`);
                pdfDoc.moveDown(0.2);
            } else if (line.length === 0) {
                pdfDoc.moveDown(0.5);
            } else {
                // Remove marcações simples de negrito ou links para exibição limpa no PDF
                const cleanLine = line
                    .replace(/\*\*(.*?)\*\*/g, '$1')
                    .replace(/\[(.*?)\]\(.*?\)/g, '$1');
                
                pdfDoc.fillColor('#334155').fontSize(10).font('Helvetica').text(cleanLine);
                pdfDoc.moveDown(0.3);
            }

            // Verifica se está muito próximo do rodapé para quebrar a página
            if (pdfDoc.y > 750) {
                pdfDoc.addPage();
                pdfDoc.rect(0, 0, pdfDoc.page.width, pdfDoc.page.height).fill('#ffffff');
                pdfDoc.fillColor('#334155');
            }
        }
    }

    // Renderizar Arquitetura
    renderMarkdownToPdf(doc, archMd);

    // Nova Seção: Relatório de Conformidade
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
    doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('2. Relatório de Conformidade e Vulnerabilidades', 50, 50);
    doc.moveDown(1);

    // Renderizar Conformidade
    renderMarkdownToPdf(doc, compMd);

    // Nova Seção: Relatório de Testes Executivos e Técnicos PQC
    if (testReportMd) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
        doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('3. Relatório da Suíte de Testes PQC e Segurança', 50, 50);
        doc.moveDown(1);
        renderMarkdownToPdf(doc, testReportMd);
    }

    doc.end();
    console.log(`\n🎉 PDF da Arquitetura e Relatório de Conformidade/Testes gerado com sucesso!`);
    console.log(`📍 Localização: ${outputPdfPath}`);
}

generatePdf().catch(err => {
    console.error('❌ Ocorreu um erro ao gerar o PDF:', err);
    process.exit(1);
});
