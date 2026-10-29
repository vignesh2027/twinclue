import type {Puzzle} from './types.js';
/**
 * A last-resort sample used by the demo only when no audited puzzle exists, labelled UNAUDITED on the overlay.
 * The old Mario sample was removed: its half B ("His brother is often shown in green") named the answer alone.
 * Each half here fits several dishes on its own.
 */
export const demoPuzzlePack:Puzzle[]=[
{id:'demo-biryani',category:'food',difficulty:'medium',answer:'Biryani',aliases:['Biriyani'],halfA:'A spiced rice dish shared across South Asia',halfB:'Often prepared in layers for a celebration meal',halfAAlsoFits:['Pulao','Fried rice','Khichdi'],halfBAlsoFits:['Lasagna','Paella','Casserole'],alsoFitsA:['Pulao','Fried rice','Khichdi'],alsoFitsB:['Lasagna','Paella','Casserole']}
];
