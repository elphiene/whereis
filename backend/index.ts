// Initialise DB (creates tables on first run)
import './src/db/schema.ts';

import { Router } from './src/lib/router.ts';
import { getMe, patchMyColour }                                 from './src/routes/users.ts';
import { getColours }                                           from './src/routes/colours.ts';
import { validateInvite, createInvite, deleteActiveInvite, completeRegistration } from './src/routes/invites.ts';
import { getMembers, removeMember }                             from './src/routes/members.ts';
import { pauseTracking, resumeTracking, leaveGroup }            from './src/routes/tracking.ts';
import { getNotificationPrefs, putNotificationPrefs, sendTestNotification } from './src/routes/notifications.ts';
import { handleWebhook }                                        from './src/routes/webhook.ts';

const router = new Router();

// User
router.get('/users/me',        getMe);
router.patch('/users/me/colour', patchMyColour);

// Colours
router.get('/colours', getColours);

// Invites — order matters: fixed path before param path
router.delete('/invites/active',   deleteActiveInvite);
router.get('/invite/:token',       validateInvite);
router.post('/invites',            createInvite);
router.post('/register',           completeRegistration);

// Members
router.get('/members',             getMembers);
router.delete('/members/:userId',  removeMember);

// Tracking
router.post('/pause',  pauseTracking);
router.post('/resume', resumeTracking);
router.post('/leave',  leaveGroup);

// Notifications
router.get('/notifications/prefs',  getNotificationPrefs);
router.put('/notifications/prefs',  putNotificationPrefs);
router.post('/notify/test',         sendTestNotification);

// Webhook (no auth — called internally by Traccar)
router.post('/webhook', handleWebhook);

const PORT = parseInt(process.env.PORT ?? '3000', 10);

Bun.serve({
  port: PORT,
  async fetch(req) {
    try {
      return await router.handle(req);
    } catch (err) {
      console.error('Unhandled error:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});

console.log(`WhereIs? backend listening on port ${PORT}`);
