import { Controller, Post, Body, Ip, Headers, Req, Res } from '@nestjs/common';
import * as express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { refreshToken, ...result } = await this.authService.login(loginDto, ipAddress, userAgent);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: SEVEN_DAYS_MS,
      path: '/api/auth',
    });

    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('logout')
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: '/api/auth',
      secure: isProd,
      sameSite: 'strict',
    });

    return { message: 'Logout exitoso' };
  }

}
