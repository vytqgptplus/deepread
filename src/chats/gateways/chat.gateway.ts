import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Chat Gateway for real-time WebSocket communication.
 * 
 * Note: This gateway is prepared for WebSocket support if needed.
 * Currently, the primary streaming mechanism is SSE via ChatController.
 * 
 * WebSocket events:
 * - join_conversation: Join a conversation room
 * - leave_conversation: Leave a conversation room
 * - send_message: Send a message (for WebSocket clients)
 * - ai_chunk: AI response chunk (streamed)
 * - ai_done: AI response complete
 * - ai_error: AI response error
 */
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('ChatGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join a conversation room for real-time updates.
   */
  handleJoinConversation(client: Socket, conversationId: string) {
    client.join(`conversation:${conversationId}`);
    this.logger.log(`Client ${client.id} joined conversation ${conversationId}`);
  }

  /**
   * Leave a conversation room.
   */
  handleLeaveConversation(client: Socket, conversationId: string) {
    client.leave(`conversation:${conversationId}`);
    this.logger.log(`Client ${client.id} left conversation ${conversationId}`);
  }

  /**
   * Broadcast message to all clients in a conversation.
   */
  broadcastToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }
}
