import { Vault } from "obsidian";

//单例模板
export class FileMgr
{
    private static _inst:FileMgr;
    public static get inst(): FileMgr {
        if(!FileMgr._inst)
            FileMgr._inst = new FileMgr();
        return FileMgr._inst
    }
    constructor(){
    }

    //创建文件
    public CreateFile(_name : string){
        // Vault.
    }
}