import { ApiProperty } from '@nestjs/swagger';

export class BookResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  author: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileType: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  pages: number;

  @ApiProperty()
  format: string;

  @ApiProperty()
  processingStatus: string;

  @ApiProperty()
  contentPreview: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BookContentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  pages: number;
}

export class ProcessingStatusDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  processingStatus: 'pending' | 'processing' | 'processed' | 'failed';

  @ApiProperty()
  message?: string;
}
