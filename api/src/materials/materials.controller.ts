import { Controller, Get, Param, Query } from '@nestjs/common'
import { MaterialsService } from './materials.service'

@Controller('materials')
export class MaterialsController {
	constructor(private readonly materialsService: MaterialsService) {}

	@Get()
	list(
		@Query('category') category?: string,
		@Query('search') search?: string,
	) {
		return this.materialsService.list(category, search)
	}

	@Get(':id')
	get(@Param('id') id: string) {
		return this.materialsService.get(id)
	}
}
