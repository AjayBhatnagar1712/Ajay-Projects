import java.util.Scanner;
public class Q4 {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.println("Enter v : ");
        int a = sc.nextInt();
        System.out.println("Enter u : ");
        int b = sc.nextInt();
        System.out.println("Enter a : ");
        int c = sc.nextInt();
        System.out.println("Enter s : ");
        int d = sc.nextInt();
        int e = (a * a - b * b) / (2 * c * d);
        System.out.println(e);
    }
}
