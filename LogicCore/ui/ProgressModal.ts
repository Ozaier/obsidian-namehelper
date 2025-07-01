import { Modal, App } from "obsidian";

export class ProgressModal extends Modal {
    progressBar: HTMLDivElement;
    progressText: HTMLSpanElement;
  
    constructor(app: App, title: string) {
      super(app);
      
      this.titleEl.setText(title);
      
      const progressContainer = this.contentEl.createDiv({ cls: 'progress-container' });
      this.progressBar = progressContainer.createDiv({ cls: 'progress-bar' });
      this.progressText = progressContainer.createEl('span', { text: '0%' });
      
      // 添加样式
      this.contentEl.addClass('name-helper-progress-modal');
      progressContainer.addClass('name-helper-progress-container');
      this.progressBar.addClass('name-helper-progress');
      this.progressText.addClass('name-helper-progress-text');
    }
  
    updateProgress(progress: number) {
      this.progressBar.style.width = `${progress * 100}%`;
      this.progressText.setText(`${Math.round(progress * 100)}%`);
    }
  
    onOpen() {
      // 添加CSS样式
      const style = document.createElement('style');
      style.id = 'name-helper-progress-style';
      style.textContent = `
        .name-helper-progress-modal .progress-container {
          width: 100%;
          background-color: var(--background-modifier-border);
          border-radius: 4px;
          margin-top: 10px;
        }
        
        .name-helper-progress {
          height: 20px;
          background-color: var(--interactive-accent);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .name-helper-progress-text {
          display: block;
          text-align: center;
          margin-top: 5px;
          font-size: 14px;
        }
      `;
      document.head.appendChild(style);
    }
  
    onClose() {
      const style = document.getElementById('name-helper-progress-style');
      if (style) style.remove();
    }
  }    