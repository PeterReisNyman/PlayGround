import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateRealtorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  sentToEmail?: string;

  @IsString()
  @IsOptional()
  // Accept the full Vimeo iframe snippet copied from the embed dialog.
  // Previous validation expected just the URL which caused a 400 error
  // when the client submitted the entire <iframe> tag as instructed in
  // the onboarding docs.
  @Matches(/^<iframe.*player\.vimeo\.com/i)
  videoUrl?: string;

  @IsOptional()
  calendarUse?: boolean;
}
