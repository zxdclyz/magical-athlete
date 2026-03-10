import type { RacerName } from '@magical-athlete/engine';

const RACER_IMAGE_MAP: Record<RacerName, string> = {
  alchemist: 'racer_01.png',
  baba_yaga: 'racer_02.png',
  banana: 'racer_03.png',
  blimp: 'racer_04.png',
  centaur: 'racer_05.png',
  cheerleader: 'racer_06.png',
  coach: 'racer_07.png',
  copy_cat: 'racer_08.png',
  dicemonger: 'racer_09.png',
  duelist: 'racer_10.png',
  egg: 'racer_11.png',
  flip_flop: 'racer_12.png',
  genius: 'racer_13.png',
  gunk: 'racer_14.png',
  hare: 'racer_15.png',
  heckler: 'racer_16.png',
  hypnotist: 'racer_17.png',
  huge_baby: 'racer_18.png',
  inchworm: 'racer_19.png',
  lackey: 'racer_20.png',
  legs: 'racer_21.png',
  leaptoad: 'racer_22.png',
  lovable_loser: 'racer_23.png',
  mouth: 'racer_24.png',
  magician: 'racer_25.png',
  mastermind: 'racer_26.png',
  party_animal: 'racer_27.png',
  rocket_scientist: 'racer_28.png',
  romantic: 'racer_29.png',
  third_wheel: 'racer_30.png',
  twin: 'racer_31.png',
  scoocher: 'racer_32.png',
  skipper: 'racer_33.png',
  suckerfish: 'racer_34.png',
  sisyphus: 'racer_35.png',
  stickler: 'racer_36.png',
};

export function getRacerImageUrl(racerName: RacerName): string {
  return `/racers/${RACER_IMAGE_MAP[racerName]}`;
}
