import prisma from '../database/prisma.js';
import { getSetting } from '../config/settings.js';
import { Message } from 'whatsapp-web.js';
import { getSafeChat } from './chatHelper.js';

export enum RoleLevel {
  MEMBER = 1,
  MODERATOR = 2,
  ADMIN = 3,
  SUPER_ADMIN = 4,
  OWNER = 5
}

export interface UserPrivileges {
  role: string;
  level: RoleLevel;
  isOwner: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
}

/**
 * Resolves the role and privilege level of a WhatsApp sender
 */
export async function getSenderPrivileges(msg: Message, client: any, groupId?: string): Promise<UserPrivileges> {
  const senderId = msg.author || msg.from;
  let rawId = senderId.replace(/[^0-9]/g, '');
  let resolvedJid = senderId;
  
  // Resolve contact phone number to support modern WhatsApp LID JIDs (only if LID)
  if (senderId.includes('lid') || senderId.startsWith('1:')) {
    try {
      const contact = await msg.getContact();
      if (contact) {
        if (contact.id && contact.id._serialized) {
          resolvedJid = contact.id._serialized;
        }
        if (contact.number) {
          rawId = contact.number;
        }
      }
    } catch (_) {}
  }

  // 1. Check if Owner
  const ownerConfig: string = await getSetting('OWNER_NUMBER');
  const ownerList = ownerConfig.split(',').map(n => n.trim()).filter(n => n.length > 0);
  
  if (
    ownerList.includes(rawId) || 
    ownerList.includes(senderId) || 
    ownerList.includes(resolvedJid) ||
    ownerList.some(o => senderId.includes(o) || resolvedJid.includes(o))
  ) {
    return {
      role: 'Owner',
      level: RoleLevel.OWNER,
      isOwner: true,
      isSuperAdmin: true,
      isAdmin: true,
      isModerator: true
    };
  }

  // 2. Check Global Admin database
  try {
    const globalAdmin = await prisma.admin.findFirst({
      where: {
        OR: [
          { whatsappId: senderId },
          { whatsappId: resolvedJid },
          { whatsappId: `${rawId}@c.us` },
          { whatsappId: rawId }
        ]
      }
    });
    if (globalAdmin) {
      const roles = globalAdmin.role.split(',').map(r => r.trim().toLowerCase());
      
      let isSuperAdmin = false;
      let isAdmin = false;
      let isModerator = false;
      let highestLevel = RoleLevel.MEMBER;

      if (roles.includes('superadmin') || roles.includes('super admin')) {
        isSuperAdmin = true;
        isAdmin = true;
        isModerator = true;
        highestLevel = RoleLevel.SUPER_ADMIN;
      }
      if (roles.includes('admin')) {
        isAdmin = true;
        isModerator = true;
        if (highestLevel < RoleLevel.ADMIN) {
          highestLevel = RoleLevel.ADMIN;
        }
      }
      if (roles.includes('moderator')) {
        isModerator = true;
        if (highestLevel < RoleLevel.MODERATOR) {
          highestLevel = RoleLevel.MODERATOR;
        }
      }

      if (highestLevel > RoleLevel.MEMBER) {
        return {
          role: roles.map(r => {
            if (r === 'superadmin') return 'Super Admin';
            return r.charAt(0).toUpperCase() + r.slice(1);
          }).join(', '),
          level: highestLevel,
          isOwner: false,
          isSuperAdmin,
          isAdmin,
          isModerator
        };
      }
    }
  } catch (_) {}

  // 3. Check Group roles from DB (Group-specific Moderator / Admin)
  if (groupId) {
    try {
      const dbMember = await prisma.groupMember.findFirst({
        where: {
          groupId,
          OR: [
            { whatsappId: senderId },
            { whatsappId: resolvedJid },
            { whatsappId: `${rawId}@c.us` },
            { whatsappId: rawId }
          ]
        }
      });

      if (dbMember) {
        const dbRole = dbMember.role.toLowerCase();
        if (dbRole === 'moderator') {
          return {
            role: 'Moderator',
            level: RoleLevel.MODERATOR,
            isOwner: false,
            isSuperAdmin: false,
            isAdmin: false,
            isModerator: true
          };
        } else if (dbRole === 'admin') {
          return {
            role: 'Admin',
            level: RoleLevel.ADMIN,
            isOwner: false,
            isSuperAdmin: false,
            isAdmin: true,
            isModerator: true
          };
        } else if (dbRole === 'superadmin' || dbRole === 'super admin') {
          return {
            role: 'Super Admin',
            level: RoleLevel.SUPER_ADMIN,
            isOwner: false,
            isSuperAdmin: true,
            isAdmin: true,
            isModerator: true
          };
        }
      }
    } catch (_) {}

    // 4. Check Group Admin status (Native WhatsApp Group Admins)
    try {
      const chat = await getSafeChat(msg, client, 'rbac');
      if (chat.isGroup && (chat as any).participants) {
        const participant = (chat as any).participants.find((p: any) => 
          p.id._serialized === senderId || 
          p.id._serialized === resolvedJid ||
          p.id.user === rawId ||
          p.id.user === senderId.split('@')[0] ||
          p.id.user === resolvedJid.split('@')[0]
        );
        if (participant) {
          if (participant.isSuperAdmin || participant.isAdmin) {
            return {
              role: 'Admin', // In group, admin role maps to level 3
              level: RoleLevel.ADMIN,
              isOwner: false,
              isSuperAdmin: false,
              isAdmin: true,
              isModerator: true
            };
          }
        }
      }
    } catch (_) {}
  }

  // Default: Member JID
  return {
    role: 'Member',
    level: RoleLevel.MEMBER,
    isOwner: false,
    isSuperAdmin: false,
    isAdmin: false,
    isModerator: false
  };
}
