import * as alt from 'alt-server';
import { DiscordUser } from '../interface/DiscordUser';
import { Account } from '../interface/Account';
import { goToCharacterSelect } from '../views/characters';
import { View_Events_Discord } from '../../shared/enums/views';
import { Permissions } from '../../shared/flags/permissions';
import { getUniquePlayerHash } from '../utility/encryption';
import * as sm from 'simplymongo';
import './tick';
import './voice';
import { SYSTEM_EVENTS } from '../../shared/enums/system';

const db: sm.Database = sm.getDatabase();

export class LoginController {
    static async tryLogin(player: alt.Player, data: Partial<DiscordUser>, account: Partial<Account>): Promise<void> {
        delete player.pendingLogin;
        delete player.discordToken;

        if (data.username) {
            alt.log(`[Athena] (${player.id}) ${data.username} has authenticated.`);
        }

        const currentPlayers = [...alt.Player.all];
        const index = currentPlayers.findIndex((p) => p.discord && p.discord.id === data.id && p.id !== player.id);

        if (index >= 1) {
            player.kick('That ID is already logged in.');
            return;
        }

        player.discord = data as DiscordUser;
        player.emit().event(View_Events_Discord.Close);

        // Used for DiscordToken skirt.
        if (!account) {
            // Generate New Account for Database
            let accountData: Partial<Account> | null = await db.fetchData<Account>('discord', data.id, 'accounts');
            if (!accountData) {
                const newDocument: Partial<Account> = {
                    discord: player.discord.id,
                    ips: [player.ip],
                    hardware: [player.hwidHash, player.hwidExHash],
                    lastLogin: Date.now(),
                    permissionLevel: Permissions.None
                };

                account = await db.insertData<Partial<Account>>(newDocument, 'accounts', true);
            } else {
                account = accountData;
            }
        }

        await player.set().account(account);
        goToCharacterSelect(player);
    }

    static async tryDisconnect(player: alt.Player, reason: string): Promise<void> {
        if (!player.data || !player.name || player.pendingCharacterSelect || player.pendingCharacterEdit) {
            return;
        }

        try {
            alt.log(`${player.name} has logged out.`);
            player.save().onTick();
        } catch (err) {
            alt.log(`[Athena] Attempted to log player out. Player data was not found.`);
            alt.log(`[Athena] If you are seeing this message on all disconnects something went wrong above.`);
        }
    }

    static async tryDiscordQuickToken(player: alt.Player, discord: string): Promise<void> {
        if (!discord) {
            return;
        }

        // Just enough unique data.
        const hashToken: string = getUniquePlayerHash(player, discord);
        const account: Partial<Account> | null = await db.fetchData<Account>('quickToken', hashToken, 'accounts');

        if (!account) {
            player.needsQT = true;
            return;
        }

        if (!account.quickTokenExpiration || Date.now() > account.quickTokenExpiration) {
            player.needsQT = true;
            db.updatePartialData(account._id, { quickToken: null, quickTokenExpiration: null }, 'accounts');
            return;
        }

        LoginController.tryLogin(player, { id: discord }, account);
    }

    static async handleNoQuickToken(player: alt.Player): Promise<void> {
        player.needsQT = true;
    }
}

alt.onClient(SYSTEM_EVENTS.QUICK_TOKEN_NONE, LoginController.handleNoQuickToken);
alt.onClient(SYSTEM_EVENTS.QUICK_TOKEN_EMIT, LoginController.tryDiscordQuickToken);
alt.on('playerDisconnect', LoginController.tryDisconnect);
alt.on('Discord:Login', LoginController.tryLogin);
