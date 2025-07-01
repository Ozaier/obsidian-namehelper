import { FolderSetting } from "LogicCore/setting/NhSettingTab";
import { ProgressModal } from "LogicCore/ui/ProgressModal";
import NameHelperPlugin from "main";
import { Notice, TFile, TFolder } from "obsidian";

//替换结构
class ReplaceStruct{
    public NextStartIndex : number
    public NewContent : string
    public Type : string
}

//tkv数据
export class TKVData{
	Type : string
	Key : string
	Value : string
}

//单例模板
export class NameHelperMgr
{
    private static _inst:NameHelperMgr;
    public static get inst(): NameHelperMgr {
        if(!NameHelperMgr._inst)
            NameHelperMgr._inst = new NameHelperMgr();
        return NameHelperMgr._inst
    }
    constructor(){
        this.Init_Data()
    }

    //#region 数据管理

    public m_Dict_Type2DataList : Map<string, Array<TKVData>>//类型表
	public m_Dict_Type2KeyMap : Map<string, Map<string, TKVData>>//类型区分下的唯一字典表
    private m_IsReady = false // 数据准备就绪
	//初始化数据
	public Init_Data(){
        if(this.m_IsReady){
            return
        }
		//字典初始化
		this.m_Dict_Type2DataList = new Map<string, Array<TKVData>>()
		this.m_Dict_Type2KeyMap = new Map<string, Map<string, TKVData>>()
		//分配到这里
		NameHelperPlugin.inst.settings.typeKeyValueArray.forEach(value => {
			this.AddData(value)
		});
        this.m_IsReady = true
	}


	//检测数据
	public CheckData(_type : string, _key : string) : boolean{
		if(this.m_Dict_Type2KeyMap.has(_type) == false){
			this.m_Dict_Type2KeyMap.set(_type, new Map<string, TKVData>())
		}
		if(this.m_Dict_Type2KeyMap.get(_type)?.has(_key)){
			return true
		}
		return false
	}

	//添加数据
	public AddData(_data : TKVData){
		if(this.m_Dict_Type2DataList.has(_data.Type) == false){
			this.m_Dict_Type2DataList.set(_data.Type, new Array<TKVData>())
		}
		this.m_Dict_Type2DataList.get(_data.Type)?.push(_data)

		//该类型下的唯一字典
		if(this.m_Dict_Type2KeyMap.has(_data.Type) == false){
			this.m_Dict_Type2KeyMap.set(_data.Type, new Map<string, TKVData>())
		}
		this.m_Dict_Type2KeyMap.get(_data.Type)?.set(_data.Key, _data)
	}

    //#endregion


    //#region 刷新接口


    //刷新所有命名
    public RefreshAll(){
        const folderSettings = NameHelperPlugin.inst.settings.folderSettingArray
        if(folderSettings.length <= 0){
            new Notice("你需要先添加文件夹标记")
            return
        }
        folderSettings.forEach(data => {
            this.RefreshByFolderSetting(data)
        });
    }

    //根据设置刷新文件夹
    public RefreshByFolderSetting(_settingData : FolderSetting){
        if(_settingData.folder == ""){
            new Notice("文件夹路径为空")
            return
        }
        const folderOri = NameHelperPlugin.inst.app.vault.getAbstractFileByPath(_settingData.folder);
        let folder : TFolder
        if (folderOri instanceof TFolder) {
            folder = folderOri as TFolder
            const type = _settingData.type
            this.RefreshFolder(folder, type)
        }
        else{
            new Notice("文件夹路径不存在")
            return
        }
    }

    //刷新目标文件夹
    public async RefreshFolder(_folder : TFolder, _type : string){
        // 为每个文件夹获取其所有子文件
        const filesInFolder = await this.getFilesInFolderRecursive(_folder);
        if(filesInFolder.length <= 0){
            new Notice("该目录下没有文件夹")
            return
        }
        //刷新目录下所有文件
        for (let index = 0; index < filesInFolder.length; index++) {
            const file = filesInFolder[index];
            await this.RefreshFile(file, _type)
        }
    }

    //刷新当前页面
    public async RefreshFile(_targetFile : TFile | null, _type : string){
        const currentFile : TFile = _targetFile as TFile;
        if(!_targetFile){
            new Notice("请先打开一个页面")
        }
        try {
            const myVault = NameHelperPlugin.inst.app.vault
            const content = await myVault.read(currentFile);
            // const newContent = content.replace(/\{\{/g, '}}');
            const modal = new ProgressModal(NameHelperPlugin.inst.app, "Replacing text...");
            modal.open();
            //递归遍历
            await this.ReplaceContent(content, currentFile, _type, modal)
          }
        catch (error) {
            new Notice(`Error replacing text: ${error}`);
        }
    }

    //
    private async ReplaceContent(content: string, file: TFile, _type : string, modal: ProgressModal){
        let newContent = '';
        let processed = 0;
        const total = content.length;
        let replaceStruct = new ReplaceStruct()
        replaceStruct.NextStartIndex = 0
        replaceStruct.NewContent = newContent
        replaceStruct.Type = _type
        while (processed < total) {
            // 处理一批字符
            const chunk = content.substring(processed, processed + NameHelperPlugin.inst.settings.handle_batchSize);
            replaceStruct = this.ReplaceArea(chunk, replaceStruct)
            processed = processed + replaceStruct.NextStartIndex//获取下一次的遍历起点
            newContent = newContent + replaceStruct.NewContent//更新新的文本
            // 更新进度
            const progress = processed / total;
            modal.updateProgress(progress);
            // 让出线程给UI渲染
            await new Promise(resolve => setTimeout(resolve, NameHelperPlugin.inst.settings.handle_interval));
        }
        //最后关闭弹窗
        modal.close()
        // 全部处理完成后写入文件
        await NameHelperPlugin.inst.app.vault.modify(file, newContent);
    }

    /**
     * 传入的是区间内的文本
     * @param _content 
     * @returns 返回下一次的遍历起点
     */
    private ReplaceArea(_content : string, _struct : ReplaceStruct) : ReplaceStruct{
        //查找{{}}
        const startPattern = /\{\{/g;
        const endPattern = /\}\}/g;
        let startMatch, endMatch;
        // 先找到起点
        let startPosition : number = 0
        startMatch = startPattern.exec(_content)
        if(startMatch != null){
            startPosition = startMatch.index
        }
        else{
            //直接没找到起点，直接返回结束地的index，从下一个文本开始
            //这里文本不用变
            _struct.NewContent = _content
            _struct.NextStartIndex = _content.length
            return _struct
        }

        // 然后找到终点
        let endPosition : number = 0
        endMatch = endPattern.exec(_content)
        if(endMatch != null){
            endPosition = endMatch.index
        }
        else{
            //没找到终点，返回这个起点+1，就是排除这个起点
            _content = _content.substring(0, 1)
            _struct.NewContent = _content.substring(0, 1)
            _struct.NextStartIndex = 1
            return _struct
        }

        //如果结束的位置比开始的位置更前，返回这个开始的位置
        if(endPosition < startPosition){
            //把这个开始位置前的都裁剪出来
            _content = _content.substring(0, startPosition)
            _struct.NewContent = _content.substring(0, 1)
            _struct.NextStartIndex = 1
            return _struct
        }

        //进行替换操作
        const startContent = _content.substring(0, startPosition)//修改文本前的基础文本
        // const endContent = _content.substring(endPosition + 2, _content.length)
        let changeContent = ""//修改后的文本

        const toChangeContent = _content.substring(startPosition + 2, endPosition)//要进行修改的内容
        let arrayAfter = toChangeContent.split(NameHelperPlugin.inst.settings.symbol_split)//用设置里的分割符号进行切分
        if(arrayAfter.length != 2){
            //如果格式不对，直接原文
            changeContent = _content.substring(startPosition, endPosition)
        }
        else{
            const NameKey = arrayAfter[0]
            const NameValue = this.GetByTk(_struct.Type, NameKey) || ""
            changeContent = NameHelperPlugin.inst.settings.symbol_start 
            + NameKey  + NameHelperPlugin.inst.settings.symbol_split + NameValue 
            + NameHelperPlugin.inst.settings.symbol_end
        }
        
        _content = startContent + changeContent
        _struct.NewContent = _content
        _struct.NextStartIndex = endPosition + 2
        //从这个结束地开始下一次遍历,index + 2
        return _struct
    }


    	//尝试刷新
	public TryRefreshByFile(_file : TFile | null){
		if(!_file){
			return
		}
		const allFolders = NameHelperPlugin.inst.settings.folderSettingArray
		let isFinded = false
		let curFolder : TFolder = _file.parent as TFolder
		for (let index = 0; index < 100; index++) {
			if(!curFolder){
				//没有父文件夹以及标记
				new Notice("该文件没有指定的父文件夹以及标记类型")
				return
			}
			//遍历100次真的够了吧
			isFinded = false
			for (let index = 0; index < allFolders.length; index++) {
				const element = allFolders[index];
				if(element.folder == curFolder.path){
					NameHelperMgr.inst.RefreshFile(NameHelperPlugin.inst.app.workspace.getActiveFile(), element.type)
					isFinded = true
					break			
				}
				if(isFinded){
					break
				}
			}
			if(isFinded){
				break
			}
			//继续定位新的folder
			curFolder = curFolder.parent as TFolder
		}
	}

    
    //#endregion

    //#region 工具

    //根据类型和key值尝试获取最终的value值
    private GetByTk(_type : string, _key : string) : string | undefined{
        if(this.m_Dict_Type2KeyMap.has(_type) == false){
            return ""
        }
        const kvMap = this.m_Dict_Type2KeyMap.get(_type)

        if(kvMap){
            if(kvMap.has(_key) == false){
                return ""
            }
            let result = kvMap.get(_key)?.Value
            return result
        }
        else{
            return ""
        }
    }

    // 递归获取文件夹及其子目录下的所有文件
    private async getFilesInFolderRecursive(folder: TFolder): Promise<TFile[]> {
        const files: TFile[] = [];
        
        // 使用 vault.getAbstractFileByPath 和 children 属性
        const folderObj = NameHelperPlugin.inst.app.vault.getAbstractFileByPath(folder.path) as TFolder;
        if (!folderObj) return files;
        
        // 遍历文件夹中的所有项
        for (const child of folderObj.children) {
            if (child instanceof TFile) {
                files.push(child);
            }
            else if (child instanceof TFolder) {
                // 递归获取子文件夹中的文件
                const subFiles = await this.getFilesInFolderRecursive(child);
                files.push(...subFiles);
            }
        }
        return files;
    }
    //#endregion
}