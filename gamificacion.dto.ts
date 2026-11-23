export class LogroResponseDto {
  id!: string;
  title!: string;
  description!: string;
  icon!: string;
  xpReward!: number;
  currentProgress!: number;
  targetValue!: number;
  unlocked!: boolean;
}

export class PerfilGamificacionResponseDto {
  userId!: number;
  username!: string;
  totalXp!: number;
  level!: number;
  rankTitle!: string;
  rankIcon!: string;
  currentLevelXp!: number;
  nextLevelXp!: number;
  progressPercent!: number;
  unlockedCount!: number;
  totalAchievements!: number;
  achievements!: LogroResponseDto[];
}

export class SimularXpRequestDto {
  userId!: number;
  extraDays!: number;
  reason!: string;
}

export class RankingItemDto {
  position!: number;
  userId!: number;
  username!: string;
  level!: number;
  rankTitle!: string;
  rankIcon!: string;
  totalXp!: number;
  unlockedCount!: number;
  isCurrentUser!: boolean;
}