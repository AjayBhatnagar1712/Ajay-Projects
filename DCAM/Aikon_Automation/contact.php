<?php
declare(strict_types=1);

$recipientEmail = 'hello@aikonautomations.com';
$emailSubjectPrefix = 'Aikon Automations Website Enquiry';
$successRedirect = 'thank-you.html';
$errorRedirect = 'contact.html?status=error';
$invalidRedirect = 'contact.html?status=invalid';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: contact.html');
    exit;
}

if (!empty($_POST['website'] ?? '')) {
    header('Location: ' . $successRedirect);
    exit;
}

$sanitize = static function (string $value): string {
    $value = trim($value);
    return preg_replace('/[\r\n]+/', ' ', $value) ?? '';
};

$name = $sanitize($_POST['name'] ?? '');
$email = filter_var(trim($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$phone = $sanitize($_POST['phone'] ?? '');
$company = $sanitize($_POST['company'] ?? '');
$service = $sanitize($_POST['service'] ?? '');
$market = $sanitize($_POST['market'] ?? '');
$timeline = $sanitize($_POST['timeline'] ?? '');
$preferredContact = $sanitize($_POST['preferred_contact'] ?? '');
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || $service === '' || $market === '' || $message === '' || $email === false) {
    header('Location: ' . $invalidRedirect);
    exit;
}

$subject = $emailSubjectPrefix . ' - ' . $service . ' - ' . $market;

$bodyLines = [
    'New enquiry from the Aikon Automations website',
    '',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    'Company: ' . ($company !== '' ? $company : 'Not provided'),
    'Service: ' . $service,
    'Target market: ' . $market,
    'Timeline: ' . ($timeline !== '' ? $timeline : 'Not provided'),
    'Preferred contact: ' . ($preferredContact !== '' ? $preferredContact : 'Not provided'),
    '',
    'Message:',
    $message
];

$body = implode(PHP_EOL, $bodyLines);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: Aikon Automations Website <' . $recipientEmail . '>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion()
];

$sent = mail($recipientEmail, $subject, $body, implode("\r\n", $headers));

header('Location: ' . ($sent ? $successRedirect : $errorRedirect));
exit;
