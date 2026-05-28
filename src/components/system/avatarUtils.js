const BASE_URL = import.meta.env.BASE_URL || '/';

const AVATAR_FILE_BY_NAME = {
  강성호: '강성호.jpg',
  권도엽: '권도엽.jpeg',
  김민수: '김민수.jpg',
  김연수: '김연수.jpg',
  김지현: '김지현.png',
  김찬솔: '김찬솔.jpg',
  김행단: '김행단.webp',
  박동민: '박동민.jpg',
  오채은: '오채은.jpg',
  우형석: '우형석.webp',
  유미현: '유미현.jpg',
  유민종: '유민종.jpg',
  윤관식: '윤관식.webp',
  윤재진: '윤재진.jpg',
  이구: '이구.jpg',
  이관용: '이관용.webp',
  이승훈: '이승훈.png',
  이시정: '이시정.webp',
  이정훈B: '이정훈B.jpg',
  이주영: '이주영.jpg',
  이준수: '이준수.jpg',
  이진우: '이진우.jpg',
  이하영: '이하영.jpg',
  이현호: '이현호.png',
  임주우: '임주우.jpg',
  전기영: '전기영.webp',
  정승우: '정승우.jpg',
  정조민: '정조민.webp',
  조청원: '조청원.jpg',
  최성현: '최성현.jpg',
  최정택: '최정택.jpg',
  한상후: '한상후.jpg',
  한원석: '한원석.jpg',
};

export function cleanAvatarName(value) {
  return String(value || '').replace(/\s/gu, '').trim();
}

function asPublicUrl(fileName) {
  if (!fileName) return '';
  if (/^https?:\/\//iu.test(fileName) || fileName.startsWith('data:')) return fileName;
  return `${BASE_URL}${fileName.replace(/^\/+/u, '')}`;
}

export function avatarCandidates(memberInfo = {}, fallbackName = '') {
  const explicit = [
    memberInfo.avatar_url,
    memberInfo.avatarUrl,
    memberInfo.photo_url,
    memberInfo.photoUrl,
    memberInfo.picture,
    memberInfo.profile_image_url,
    memberInfo.profileImageUrl,
    memberInfo.image_url,
  ].find(Boolean);
  const name = cleanAvatarName(fallbackName || memberInfo.staff_name || memberInfo.name);
  return [...new Set([
    explicit ? asPublicUrl(explicit) : '',
    asPublicUrl(AVATAR_FILE_BY_NAME[name]),
    name ? asPublicUrl(`${name}.webp`) : '',
    asPublicUrl('default_avatar.svg'),
  ].filter(Boolean))];
}

export function avatarLabel(memberInfo = {}, fallbackName = '사용자') {
  return String(fallbackName || memberInfo.staff_name || memberInfo.name || '사용자').trim();
}
