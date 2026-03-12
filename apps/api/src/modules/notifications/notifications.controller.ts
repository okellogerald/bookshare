import { Controller, Get, Patch, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";
import { ListNotificationsQueryDto } from "./dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser("id") userId: string,
    @Query() query: ListNotificationsQueryDto
  ) {
    return this.notificationsService.findAll(userId, query);
  }

  @Get("unread-count")
  unreadCount(@CurrentUser("id") userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser("id") userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.notificationsService.markRead(id, userId);
  }
}
