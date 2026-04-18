import { Module } from "@nestjs/common";
import { ReadGatewayController } from "./read-gateway.controller";
import { ReadGatewayService } from "./read-gateway.service";

@Module({
  controllers: [ReadGatewayController],
  providers: [ReadGatewayService],
})
export class ReadGatewayModule {}
