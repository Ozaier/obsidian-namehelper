//单例模板
export class InstanceTemplate
{
    private static _inst:InstanceTemplate;
    public static get inst(): InstanceTemplate {
        if(!InstanceTemplate._inst)
            InstanceTemplate._inst = new InstanceTemplate();
        return InstanceTemplate._inst
    }
    constructor(){
    }
}