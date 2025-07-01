import { NameHelperMgr } from 'LogicCore/core/NameHelperMgr';
import { App, Notice, Plugin, PluginManifest, TFile, TFolder } from 'obsidian';
import { DEFAULT_SETTINGS, NhSettingData, NhSettingTab } from './LogicCore/setting/NhSettingTab';

// Remember to rename these classes and interfaces!


export default class NameHelperPlugin extends Plugin {
	//#region 单例初始化
	private static _inst:NameHelperPlugin;
	public static get inst(): NameHelperPlugin {
		return NameHelperPlugin._inst
	}
	private static set inst(_curInst : NameHelperPlugin){
		NameHelperPlugin._inst = _curInst
	}
	constructor(_app: App, _manifest: PluginManifest){
		super(_app, _manifest)
		//单例实现
		NameHelperPlugin.inst = this
	}
	//#endregion

	//#region 生命周期

	async onload() {
		await this.loadSettings();

		//侧边栏
		this.Init_Ribbon()
		//命令相关
		this.Init_Command()
		//设置初始化
		this.Init_Setting()
	}

	onunload() {

	}

	//#endregion

	//#region 存档相关

	settings: NhSettingData;//设置存档

	//加载设置
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	//保存数据
	async saveSettings() {
		await this.saveData(this.settings);
	}

	//初始化设置
	private Init_Setting(){
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new NhSettingTab(this.app, this));
	}

	//#endregion

	//#region 左侧按钮

	//侧边栏初始化
	private Init_Ribbon(){
		const ribbonIconEl = this.addRibbonIcon('square-pen', 'RefreshCurName', (evt: MouseEvent) => {
			NameHelperMgr.inst.TryRefreshByFile(this.app.workspace.getActiveFile())
		});
	}




	//#endregion

	//#region 命令相关初始化

	//初始化命令相关
	private Init_Command(){
		//刷新全部
		this.addCommand({
			id: 'RefreshName',
			name: 'RefreshName',
			callback: () => {
				NameHelperMgr.inst.RefreshAll()
			}
		});

		//刷新当前
		this.addCommand({
			id: 'RefreshCurName',
			name: 'RefreshCurName',
			callback: () => {
				NameHelperMgr.inst.TryRefreshByFile(this.app.workspace.getActiveFile())
			}
		});
	}

	
	//#endregion



}


