import * as alt from 'alt-server';
import { getDescription } from '../../shared/commands/commandList';
import { CommandsLocale } from '../../shared/locale/commands';
import { addCommand } from '../systems/chat';

addCommand('setarmour', handleCommand);

function handleCommand(player: alt.Player, value: number = 100, targetPlayerID: string | null = null): void {
    if (isNaN(value)) {
        player.emit().message(getDescription('setarmour'));
        return;
    }

    if (value < 0) {
        value = 0;
    }

    if (value > 100) {
        value = 100;
    }

    if (targetPlayerID === null) {
        finishSetArmour(player, value);
        return;
    }

    const target: alt.Player = [...alt.Player.all].find((x) => x.id.toString() === targetPlayerID);
    if (!target) {
        player.emit().message(CommandsLocale.CANNOT_FIND_PLAYER);
        return;
    }

    finishSetArmour(target, value);
}

function finishSetArmour(target: alt.Player, value: number) {
    target.safe().addArmour(value, true);
    target.emit().message(`${CommandsLocale.ARMOUR_SET_TO}${value}`);
}
