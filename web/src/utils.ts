export function getId(): string {
    const url = window.location.href;
    const items = url.split('/');
    const id = items[items.length - 1];
    return id;
}
