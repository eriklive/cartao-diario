import { Injectable, inject } from '@angular/core';
import {
  criarDocumentoPdf,
  criarPlanilha,
  montarExportacao,
  nomeArquivoExportacao,
  type FormatoExportacao,
  type OpcoesExportacao,
} from '@cartao/shared/export';
import { CartaoStore } from '../dados/cartao-store';

type PdfMake = typeof import('pdfmake/build/pdfmake');

const TIPOS: Record<FormatoExportacao, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** O módulo pode vir como CommonJS embrulhado (`default`) ou como namespace. */
function padrao<T>(modulo: unknown): T {
  const m = modulo as { default?: T };
  return (m.default ?? modulo) as T;
}

/**
 * Gera o PDF e a planilha no próprio aparelho. As bibliotecas (~2 MB)
 * só carregam aqui, na primeira exportação, e ficam no cache do app.
 */
@Injectable({ providedIn: 'root' })
export class Exportacao {
  private readonly store = inject(CartaoStore);
  private pdfMake?: Promise<PdfMake>;

  async gerar(formato: FormatoExportacao, opcoes: OpcoesExportacao): Promise<File> {
    const dados = this.store.dados();
    if (!dados) throw new Error('Dados ainda não carregados');
    const modelo = montarExportacao(dados, opcoes);
    const nome = nomeArquivoExportacao(opcoes.periodo, formato);

    let blob: Blob;
    if (formato === 'pdf') {
      const pdfMake = await this.carregarPdfMake();
      blob = await pdfMake.createPdf(criarDocumentoPdf(modelo)).getBlob();
    } else {
      const writeXlsxFile = padrao<typeof import('write-excel-file/browser').default>(
        await import('write-excel-file/browser'),
      );
      blob = await writeXlsxFile(criarPlanilha(modelo)).toBlob();
    }
    return new File([blob], nome, { type: TIPOS[formato] });
  }

  private carregarPdfMake(): Promise<PdfMake> {
    this.pdfMake ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(
      ([modPdf, modFontes]) => {
        const pdfMake = padrao<PdfMake>(modPdf);
        pdfMake.addVirtualFileSystem(padrao<Record<string, string>>(modFontes));
        return pdfMake;
      },
    );
    return this.pdfMake;
  }
}
