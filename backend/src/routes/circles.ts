import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { emitToCircle } from '../socket.js';

const router = Router();

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create circle
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Circle name is required' });
    }

    const circleId = uuidv4();
    const inviteCode = generateInviteCode();

    const { error: circleError } = await supabase.from('circles').insert({
      id: circleId,
      name,
      invite_code: inviteCode,
      owner_id: req.userId
    });

    if (circleError) {
      console.error('Create circle error:', circleError);
      return res.status(500).json({ error: 'Failed to create circle' });
    }

    // Add owner as member
    await supabase.from('circle_members').insert({
      circle_id: circleId,
      user_id: req.userId
    });

    res.status(201).json({ id: circleId, name, inviteCode, ownerId: req.userId });
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// Get user's circles
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get circle IDs user belongs to
    const { data: memberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', req.userId);

    if (!memberships || memberships.length === 0) {
      return res.json([]);
    }

    const circleIds = memberships.map(m => m.circle_id);

    const { data: circles } = await supabase
      .from('circles')
      .select('*')
      .in('id', circleIds)
      .order('created_at', { ascending: false });

    // Get member counts
    const result = await Promise.all(
      (circles || []).map(async (c) => {
        const { count } = await supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', c.id);

        return {
          id: c.id,
          name: c.name,
          inviteCode: c.invite_code,
          ownerId: c.owner_id,
          memberCount: count || 0,
          createdAt: c.created_at
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ error: 'Failed to get circles' });
  }
});

// Get circle details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Check membership
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Get members with user info
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id, joined_at')
      .eq('circle_id', req.params.id);

    const memberDetails = await Promise.all(
      (members || []).map(async (m) => {
        const { data: user } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', m.user_id)
          .single();

        return {
          userId: m.user_id,
          displayName: user?.display_name || 'Unknown',
          joinedAt: m.joined_at
        };
      })
    );

    res.json({
      id: circle.id,
      name: circle.name,
      inviteCode: circle.invite_code,
      ownerId: circle.owner_id,
      createdAt: circle.created_at,
      members: memberDetails
    });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ error: 'Failed to get circle' });
  }
});

// Join circle
router.post('/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const { data: circle } = await supabase
      .from('circles')
      .select('id, name, owner_id')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (!circle) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    // Check if already member
    const { data: existing } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', circle.id)
      .eq('user_id', req.userId)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Already a member of this circle' });
    }

    await supabase.from('circle_members').insert({
      circle_id: circle.id,
      user_id: req.userId
    });

    res.json({ id: circle.id, name: circle.name, ownerId: circle.owner_id });
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ error: 'Failed to join circle' });
  }
});

// Send message
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const circleId = req.params.id;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', circleId)
      .eq('user_id', req.userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    const messageId = uuidv4();

    const { error } = await supabase.from('messages').insert({
      id: messageId,
      circle_id: circleId,
      user_id: req.userId,
      content
    });

    if (error) {
      return res.status(500).json({ error: 'Failed to send message' });
    }

    // Get user name and created_at
    const { data: user } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', req.userId)
      .single();

    const message = {
      id: messageId,
      circleId,
      userId: req.userId,
      userName: user?.display_name || 'Unknown',
      content,
      createdAt: new Date().toISOString()
    };

    // Emit to circle members via socket
    const io = req.app.get('io');
    emitToCircle(io, circleId, 'new-message', message);

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const circleId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check membership
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', circleId)
      .eq('user_id', req.userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Get user names
    const result = await Promise.all(
      (messages || []).map(async (m) => {
        const { data: user } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', m.user_id)
          .single();

        return {
          id: m.id,
          circleId: m.circle_id,
          userId: m.user_id,
          userName: user?.display_name || 'Unknown',
          content: m.content,
          createdAt: m.created_at
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Share location
router.post('/:id/location', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng, duration } = req.body;
    const circleId = req.params.id;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Valid lat and lng are required' });
    }

    const durationMinutes = duration || 30;
    if (![15, 30, 60].includes(durationMinutes)) {
      return res.status(400).json({ error: 'Duration must be 15, 30, or 60 minutes' });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', circleId)
      .eq('user_id', req.userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    // Remove existing share
    await supabase
      .from('location_shares')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', req.userId);

    const shareId = uuidv4();
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    await supabase.from('location_shares').insert({
      id: shareId,
      circle_id: circleId,
      user_id: req.userId,
      lat,
      lng,
      expires_at: expiresAt
    });

    const { data: user } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', req.userId)
      .single();

    const locationShare = {
      id: shareId,
      circleId,
      userId: req.userId,
      userName: user?.display_name || 'Unknown',
      lat,
      lng,
      expiresAt,
      updatedAt: new Date().toISOString()
    };

    const io = req.app.get('io');
    emitToCircle(io, circleId, 'location-shared', locationShare);

    res.status(201).json(locationShare);
  } catch (error) {
    console.error('Share location error:', error);
    res.status(500).json({ error: 'Failed to share location' });
  }
});

// Get active locations
router.get('/:id/locations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const circleId = req.params.id;

    // Check membership
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('circle_id', circleId)
      .eq('user_id', req.userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    const { data: locations } = await supabase
      .from('location_shares')
      .select('*')
      .eq('circle_id', circleId)
      .gt('expires_at', new Date().toISOString());

    const result = await Promise.all(
      (locations || []).map(async (ls) => {
        const { data: user } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', ls.user_id)
          .single();

        return {
          id: ls.id,
          circleId: ls.circle_id,
          userId: ls.user_id,
          userName: user?.display_name || 'Unknown',
          lat: ls.lat,
          lng: ls.lng,
          expiresAt: ls.expires_at,
          updatedAt: ls.updated_at
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

// Stop sharing location
router.delete('/:id/location', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const circleId = req.params.id;

    await supabase
      .from('location_shares')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', req.userId);

    const io = req.app.get('io');
    emitToCircle(io, circleId, 'location-stopped', { userId: req.userId, circleId });

    res.json({ success: true });
  } catch (error) {
    console.error('Stop location error:', error);
    res.status(500).json({ error: 'Failed to stop location sharing' });
  }
});

export default router;
