public class creating_array {
    public static void main(String[] args) {
        //There are 3 ways to create a array which is also available in notes

        //Type 1 :- Declaration is done first and then memory allocation is done.

        int[] marks;
        marks = new int[5];
        marks[0] = 23;
        marks[1] = 33;
        marks[2] = 13;
        marks[3] = 43;
        marks[4] = 53;
        System.out.println(marks[4]);


        //Type 2 :- Declaration and memory allocation is done in same line.

        int[] marks2 = new int[5];
        marks2[0] = 23;
        marks2[1] = 33;
        marks2[2] = 13;
        marks2[3] = 43;
        marks2[4] = 53;
        System.out.println(marks2[2]);


        //Type 3 :- Declaration ,  memory allocation and initialization are done together

        int[] marks3 = {23, 33, 34, 45, 56};
        System.out.println(marks3[2]);

    }
}