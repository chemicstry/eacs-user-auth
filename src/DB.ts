import lowdb from 'lowdb';
import FileAsync from 'lowdb/adapters/FileAsync';
import { Log } from './Log';
import ShortId from 'shortid';

class DB {
    private db!: lowdb.LowdbAsync<any>;

    constructor(dbFile: string) {
        this.initDatabase(dbFile);
    }

    private async initDatabase(dbFile: string) {
        try {
            const adapter = new FileAsync(dbFile);
            this.db = await lowdb(adapter);

            this.db.defaults({
                users: [],
                groups: [],
            }).write();
        } catch (e) {
            Log.error("Databse init failed.", e);
            process.exit(1);
        }
    }

    public async authUID(UID: String, permission: String)
    {
        // Find groups with permission
        let groups = await <any>this.db.get('groups').filter(g => g.permissions.includes(permission)).value();

        if (!groups.length)
            return false;

        // Find user
        let user = await this.db.get('users').filter(u => {
            // has UID and is part of one of the groups
            return  u.tags.includes(UID) &&
                    u.groups.some((g:string) => groups.find((gi:any) => gi.name == g))
        }).value();

        if (user.length)
            return true;
        else
            return false;
    }

    public async getUsers() {
        return await this.db.get('users')
    }

    public async upsertUser(data: any) {
        // Update if exists, create new otherwise
        if (data.id)
            this.db.get('users').find({id:data.id}).assign(data).write();
        else
            this.db.get('users').push({id:ShortId.generate(),...data}).write();
    }

    public async deleteUser(id: String) {
        this.db.get('users').remove({id}).write();
    }

    public async getGroups() {
        return await this.db.get('groups')
    }

    public async upsertGroup(data: any) {
        // Update if exists, create new otherwise
        if (data.id)
            this.db.get('groups').find({id:data.id}).assign(data).write();
        else
            this.db.get('groups').push({id:ShortId.generate(),...data}).write();
    }

    public async deleteGroup(id: String) {
        this.db.get('groups').remove({id}).write();
    }
}

export default DB;
