import NameHelperPlugin from "main";
import { PluginSettingTab, App, Setting, TextComponent, Notice, ButtonComponent } from "obsidian";
import { FolderSuggest } from "./suggesters/FolderSuggester";
import { NameHelperMgr, TKVData } from "LogicCore/core/NameHelperMgr";

//文件夹对应的类型
export class FolderSetting {
    folder: string;
    type: string;
}


//设置数据
export interface NhSettingData {
	symbol_start: string;
	symbol_split: string;
	symbol_end: string;
	handle_interval: number;//处理间隔
	handle_batchSize: number;//处理个数

	folderSettingArray : FolderSetting[];//保存的文件夹类型列表
	typeArray : string[]//类型数组
	typeKeyValueArray : TKVData[];//保存的kv值,格式： 类型:Key值_Value值
}
//nh的默认设置
export const DEFAULT_SETTINGS: NhSettingData = {
	symbol_start:'{{',
	symbol_split:'-',
	symbol_end:'}}',
	handle_interval: 50,//处理间隔
	handle_batchSize: 1000,//处理字符批量

	folderSettingArray:[],//文件夹类型列表
	typeArray:[],//类型数组
	typeKeyValueArray:[],//初始啥都没有保存
}

//设置tab
export class NhSettingTab extends PluginSettingTab {
	plugin: NameHelperPlugin;

	constructor(app: App, plugin: NameHelperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('起始符号')
			.addText(text => text
				.setPlaceholder('{{')
				.setValue(this.plugin.settings.symbol_start)
				.onChange(async (value) => {
					this.plugin.settings.symbol_start = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('分割符号')
		.addText(text => text
			.setPlaceholder('{{')
			.setValue(this.plugin.settings.symbol_split)
			.onChange(async (value) => {
				this.plugin.settings.symbol_split = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('结尾符号')
		.addText(text => text
			.setPlaceholder('}}')
			.setValue(this.plugin.settings.symbol_end)
			.onChange(async (value) => {
				this.plugin.settings.symbol_end = value;
				await this.plugin.saveSettings();
			}));

		//初始化标记
		this.Init_TypeMark()
		//初始化文件夹分布
		this.Init_Folder()
		//初始化存档
		this.Init_KVMap()

	}

	//#region 类型标记


	NameKVSetting :Setting
	typeInput : TextComponent
	keyInput : TextComponent
	valueInput : TextComponent

	private Init_TypeMark(){
		this.NameKVSetting = new Setting(this.containerEl);

		//类型
		this.typeInput = new TextComponent(this.NameKVSetting.controlEl);
		this.typeInput.setPlaceholder("TypeName");
		this.typeInput.inputEl.addClass("nhmark-settings-type");
		//key
		this.keyInput = new TextComponent(this.NameKVSetting.controlEl);
		this.keyInput.setPlaceholder("Key");
		this.keyInput.inputEl.addClass("nhmark-settings-key");
		//value
		this.valueInput = new TextComponent(this.NameKVSetting.controlEl);
		this.valueInput.setPlaceholder("Value");
		this.valueInput.inputEl.addClass("nhmark-settings-value");

		//这是一整个方块
		this.NameKVSetting
		.setName("保存标记值和实际值")
		.setClass("nhplugin-setting-item")
		.setDesc(`这里可以保存对应的key和value值`)
		.addDropdown((dropdown)=>{
			//下拉类型
			NameHelperMgr.inst.m_Dict_Type2DataList.forEach((value, key) => {
				dropdown.addOption(key, key)
			});
			dropdown.setValue(this.curType)
			dropdown.onChange((value)=>{
				this.ChangeType(value)
			})
		})
		.addButton((button) => {
			//添加按钮
			button.setClass("HighlightrSettingsButton")
				.setClass("HighlightrSettingsButtonAdd")
				.setIcon("highlightr-save")
				.setTooltip("Save")
				.onClick(async (buttonEl: any)=>{
					//保存
					this.OnClickSave()
					//然后刷新
					this.display();
				})
		});
	}

	//点击保存
	private async OnClickSave(){
		let typeStr = this.typeInput.inputEl.value;
		let keyStr = this.keyInput.inputEl.value;
		let valueStr = this.valueInput.inputEl.value;
		
		let newData = new TKVData()
		newData.Type = typeStr
		newData.Key = keyStr
		newData.Value = valueStr

		if(NameHelperMgr.inst.CheckData(newData.Type, newData.Key) == false){
			//添加数据
			NameHelperMgr.inst.AddData(newData)
			//存档
			this.AddSave(newData)
		}
		else{
			new Notice("该key值在类型" + newData.Type + "中已存在")
		}

		//清空
		this.typeInput.inputEl.value = ""
		this.keyInput.inputEl.value = ""
		this.valueInput.inputEl.value = ""

		await this.plugin.saveSettings();	
	}

	//#endregion

	//#region 初始化文件夹

	FolderSetting :Setting

	//初始化文件夹
	private Init_Folder(){

		this.FolderSetting = new Setting(this.containerEl);
		//这是一整个方块
		this.FolderSetting
		.setName("文件夹标记")
		.setDesc("文件夹和类型一一对应，分开刷新")
		.addButton((button: ButtonComponent) => {
            button
                .setButtonText("添加文件夹标记")
                .setTooltip("Add additional folder template")
                .setCta()
                .onClick(() => {
                    this.plugin.settings.folderSettingArray.push({
                        folder: "",
                        type: "",
                    });
					this.SaveData()
                });
        });

		//文件夹存储
        this.plugin.settings.folderSettingArray.forEach(
            (folder_template, index) => {
				let curData = this.plugin.settings.folderSettingArray[index]
                const s = new Setting(this.containerEl)
                    .addSearch((cb) => {
                        new FolderSuggest(this.app, cb.inputEl);
                        cb.setPlaceholder("Folder")
                            .setValue(folder_template.folder)
                            .onChange((new_folder) => {
                                if (new_folder &&
                                    this.plugin.settings.folderSettingArray.some((e) => e.folder == new_folder)
                                ) {
									console.log("This folder already has a template associated with it")
                                    return;
                                }

                                this.plugin.settings.folderSettingArray[
                                    index
                                ].folder = new_folder;
								this.SaveData()
                            });
                        // @ts-ignore
                        cb.containerEl.addClass("templater_search");
                    })
					.addDropdown((dropdown)=>{
						//下拉类型
						NameHelperMgr.inst.m_Dict_Type2DataList.forEach((value, key) => {
							dropdown.addOption(key, key)
						});
						dropdown.setValue(curData.type)
						dropdown.onChange((value)=>{
							//保存至这个设置里
							this.plugin.settings.folderSettingArray[
								index
							].type = value;
							this.SaveData()
						})
					})
					.addButton((button)=>{
						button.setButtonText("刷新")
						.setCta()
						.onClick(()=>{
							//单独刷新这个文件夹
							NameHelperMgr.inst.RefreshByFolderSetting(curData)
						})
					})
                    .addExtraButton((cb) => {
                        cb.setIcon("cross")
                            .setTooltip("Delete")
                            .onClick(() => {
                                this.plugin.settings.folderSettingArray.splice(
                                    index,
                                    1
                                );
								this.SaveData();
                            });
                    });
                s.infoEl.remove();
            }
        );
	}

	//#endregion

	//#region 初始化列表

	curType : string

	//初始化
	private Init_KVMap(){
		//容器
		const highlightersContainer = this.containerEl.createEl("div", {
			cls: "HighlightrSettingsTabsContainer",
		});

		if(!this.curType || this.curType == ""){
			//没有指定类型
			return
		}
		if(NameHelperMgr.inst.m_Dict_Type2DataList.has(this.curType) == false){
			NameHelperMgr.inst.m_Dict_Type2DataList.set(this.curType, new Array<TKVData>())
		}
		let curArray = NameHelperMgr.inst.m_Dict_Type2DataList.get(this.curType) || []
		curArray.forEach((data) => {
			const settingItem = highlightersContainer.createEl("div");
			settingItem.addClass("nhhelper-item-draggable");
			const colorIcon = settingItem.createEl("span");
			colorIcon.addClass("highlighter-setting-icon");

			new Setting(settingItem)
				.setClass("highlighter-setting-item")
				.setName(data.Key)
				.setDesc(data.Value)
				.addButton((button) => {
				button
					.setClass("HighlightrSettingsButton")
					.setClass("HighlightrSettingsButtonDelete")
					.setIcon("highlightr-delete")
					.setTooltip("Remove")
					.onClick(async () => {
						this.RemoveSave(data)
					});
				});
			}
		)
	}

	//修改当前显示的类型
	private ChangeType(_type : string){
		this.curType = _type
		this.display()
	}

	//#endregion

	//#region 存档

	//添加存档
	private AddSave(_data : TKVData){
		this.plugin.settings.typeKeyValueArray.push(_data)
		this.SaveData()
	}

	//移除存档
	private RemoveSave(_data : TKVData){
		this.plugin.settings.typeKeyValueArray.remove(_data)
		this.SaveData()
	}

	private async SaveData(){
		await this.plugin.saveSettings();
		this.display();
	}

	//#endregion


}
